import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { formatMoney, isCurrencyCode, money } from "@/lib/money";
import { generateReference } from "@/lib/reference";
import { db } from "@/server/db/client";
import { bookings, invoices, paymentAttempts, paymentScheduleItems, webhookEvents } from "@/server/db/schema";
import { env } from "@/server/env";
import { getEmailProvider } from "@/server/integrations/email";
import { getPaymentProvider, getProviderByKey } from "@/server/integrations/payments";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { PAYABLE, type BookingStatus } from "@/server/services/booking/transitions";
import { recordVerifiedCharge, type RecordResult } from "./record";

/** A pending checkout is reused for this long, so refresh or double clicks don't create new ones. */
const ATTEMPT_REUSE_MS = 20 * 60_000;

export type PaymentChoice = "next" | "full";

/** What the customer can pay now: the next schedule instalment, or the whole balance. */
export async function payableAmounts(bookingId: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b || !PAYABLE.has(b.status as BookingStatus) || (b.balanceMinor ?? 0n) <= 0n) return null;
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.bookingId, bookingId), eq(invoices.status, "issued")));
  const [openInv] = inv
    ? [inv]
    : await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.bookingId, bookingId), eq(invoices.status, "partially_paid")));
  if (!openInv) return null;
  const items = await db
    .select()
    .from(paymentScheduleItems)
    .where(and(eq(paymentScheduleItems.invoiceId, openInv.id), eq(paymentScheduleItems.status, "pending")))
    .orderBy(asc(paymentScheduleItems.position));
  const balance = b.balanceMinor ?? 0n;
  const next = items[0] ? (items[0].amountMinor < balance ? items[0].amountMinor : balance) : balance;
  return {
    booking: b,
    invoiceId: openInv.id,
    next: { label: items[0]?.label ?? "Balance", amountMinor: next, dueAt: items[0]?.dueAt ?? null },
    full: { label: "Full balance", amountMinor: balance },
    currency: b.currency.trim(),
  };
}

/**
 * Starts (or resumes) an online payment for a booking the caller is allowed to pay for.
 * Returns the provider checkout URL. Amounts come from the server, never from the browser.
 */
export async function startPayment(bookingId: string, choice: PaymentChoice, actorUserId: string | null) {
  const p = await payableAmounts(bookingId);
  if (!p) throw new AppError("CONFLICT", "There's nothing to pay on this booking right now.");
  const amountMinor = choice === "full" ? p.full.amountMinor : p.next.amountMinor;
  const provider = getPaymentProvider();

  const reuse = await db
    .select()
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.bookingId, bookingId),
        eq(paymentAttempts.amountMinor, amountMinor),
        eq(paymentAttempts.provider, provider.key),
        eq(paymentAttempts.status, "pending"),
        gt(paymentAttempts.createdAt, new Date(Date.now() - ATTEMPT_REUSE_MS)),
      ),
    )
    .limit(1);
  if (reuse[0]?.checkoutUrl)
    return { checkoutUrl: reuse[0].checkoutUrl, reference: reuse[0].reference, simulated: provider.simulated };

  const reference = generateReference("payment");
  const [attempt] = await db
    .insert(paymentAttempts)
    .values({
      reference,
      bookingId,
      invoiceId: p.invoiceId,
      provider: provider.key,
      amountMinor,
      currency: p.currency,
      idempotencyKey: `attempt:${reference}`,
      simulated: provider.simulated,
      createdBy: actorUserId,
    })
    .returning();

  const callbackUrl = new URL(`/bookings/${p.booking.reference}/payment-return`, env.APP_URL);
  callbackUrl.searchParams.set("reference", reference);
  try {
    const init = await provider.initialize({
      reference,
      amountMinor,
      currency: p.currency,
      email: p.booking.contactEmail,
      callbackUrl: callbackUrl.toString(),
      metadata: { booking: p.booking.reference, attempt: reference },
    });
    await db
      .update(paymentAttempts)
      .set({ status: "pending", checkoutUrl: init.checkoutUrl, providerAccessCode: init.accessCode })
      .where(eq(paymentAttempts.id, attempt.id));
    return { checkoutUrl: init.checkoutUrl, reference, simulated: provider.simulated };
  } catch (e) {
    await db.update(paymentAttempts).set({ status: "failed" }).where(eq(paymentAttempts.id, attempt.id));
    throw e;
  }
}

/**
 * Called when the customer returns from checkout. The redirect itself proves nothing: we ask
 * the provider and record only what it confirms (ARCHITECTURE §7).
 */
export async function confirmPaymentReturn(bookingId: string, reference: string) {
  const [attempt] = await db
    .select()
    .from(paymentAttempts)
    .where(and(eq(paymentAttempts.reference, reference), eq(paymentAttempts.bookingId, bookingId)));
  if (!attempt) return { state: "unknown" as const };
  if (attempt.status === "succeeded") return { state: "paid" as const };
  const provider = getProviderByKey(attempt.provider);
  if (!provider) return { state: "unknown" as const };
  const charge = await provider.verify(reference);
  if (!charge) return { state: "pending" as const };
  if (charge.status !== "success") {
    if (charge.status === "failed" || charge.status === "abandoned") {
      await db.update(paymentAttempts).set({ status: charge.status }).where(eq(paymentAttempts.id, attempt.id));
    }
    return { state: charge.status === "pending" ? ("pending" as const) : ("failed" as const) };
  }
  const result = await recordVerifiedCharge(attempt.provider as "paystack" | "mock", charge, "api_verify");
  if (result.kind === "recorded") void sendPaymentReceipt(result);
  return { state: result.kind === "recorded" || result.kind === "duplicate" ? ("paid" as const) : ("failed" as const) };
}

/**
 * Webhook entry point. Signature first; then the event is stored once per (provider, event id)
 * so replays are acknowledged without reprocessing. For Paystack, the charge is re-verified
 * through the API before it is recorded.
 */
export async function handlePaymentWebhook(providerKey: string, rawBody: string, headers: Headers) {
  const provider = getProviderByKey(providerKey);
  if (!provider) return { status: 404 as const };
  let parsed;
  try {
    parsed = provider.parseWebhook(rawBody, headers);
  } catch {
    return { status: 400 as const };
  }
  if (!parsed.signatureValid) {
    logger.warn({ provider: providerKey }, "Rejected webhook with invalid signature");
    return { status: 401 as const };
  }

  const [evt] = await db
    .insert(webhookEvents)
    .values({
      provider: provider.key,
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      signatureValid: true,
      payload: parsed.safePayload,
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });
  if (!evt) return { status: 200 as const, duplicate: true };

  let result: RecordResult | null = null;
  try {
    if (parsed.charge && parsed.eventType === "charge.success") {
      // Paystack recommends confirming with the verify API; the mock reads back its own event.
      const confirmed = provider.key === "paystack" ? await provider.verify(parsed.charge.reference) : parsed.charge;
      if (confirmed) result = await recordVerifiedCharge(provider.key, confirmed, "webhook");
      if (result?.kind === "recorded") void sendPaymentReceipt(result);
    }
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date(), error: result && result.kind === "rejected" ? result.reason : null })
      .where(eq(webhookEvents.id, evt.id));
  } catch (err) {
    logger.error({ err, eventId: parsed.eventId }, "Webhook processing failed");
    await db.update(webhookEvents).set({ error: "processing_failed" }).where(eq(webhookEvents.id, evt.id));
    // Let the provider retry: remove our record so the retry is processed.
    await db.delete(webhookEvents).where(eq(webhookEvents.id, evt.id));
    return { status: 500 as const };
  }
  return { status: 200 as const, result };
}

/** Best-effort receipt email; the payment is already recorded whether or not this succeeds. */
async function sendPaymentReceipt(r: Extract<RecordResult, { kind: "recorded" }>) {
  try {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, r.bookingId));
    if (!b) return;
    const cur = b.currency.trim();
    if (!isCurrencyCode(cur)) return;
    const fmt = (v: bigint) => formatMoney(money(v, cur), { compactZeroMinor: false });
    await getEmailProvider().send({
      to: b.contactEmail,
      subject: `Payment received for ${b.reference}`,
      text: `Hi ${b.contactName.split(" ")[0]},\n\nWe've received your payment of ${fmt(r.amountMinor)} for booking ${b.reference}.\n\nPaid so far: ${fmt(b.paidMinor)}\nBalance: ${fmt(b.balanceMinor ?? 0n)}\n\nYou can view your booking and receipt at ${env.APP_URL}/bookings/${b.reference}\n\n— ORBIS`,
      idempotencyKey: `payment-receipt:${r.transactionId}`,
    });
  } catch (err) {
    logger.error({ err, bookingId: r.bookingId }, "Payment receipt email failed");
  }
}
