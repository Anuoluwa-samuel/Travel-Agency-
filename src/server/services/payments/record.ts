import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  bookingItems,
  bookingNotes,
  bookings,
  invoices,
  ledgerEntries,
  paymentAttempts,
  paymentScheduleItems,
  transactions,
} from "@/server/db/schema";
import { logger } from "@/server/lib/logger";
import { convertHold } from "@/server/services/booking/expiry";
import { applyTransition, lockBooking } from "@/server/services/booking/state";
import { PAYABLE, statusAfterPayment, type BookingStatus } from "@/server/services/booking/transitions";
import type { VerifiedCharge } from "@/server/integrations/payments";

export type RecordResult =
  | { kind: "recorded"; bookingId: string; transactionId: string; status: BookingStatus; amountMinor: bigint }
  | { kind: "duplicate"; bookingId: string }
  | { kind: "not_successful"; status: VerifiedCharge["status"] }
  | { kind: "unknown_reference" }
  | { kind: "rejected"; reason: string };

/**
 * Records a provider-verified charge exactly once (journeys J05/J06, ARCHITECTURE §7).
 *
 * Idempotency comes from the database: `transactions (provider, provider_reference, kind)` is
 * unique, and the insert uses ON CONFLICT DO NOTHING inside the same transaction as every other
 * effect. A webhook and a browser return racing for the same payment, or a provider retry,
 * produce one transaction, one ledger entry and one status change.
 *
 * Effects, all in one transaction with the booking row locked:
 *   transaction row → ledger `payment_received` (negative) → booking paid total →
 *   attempt succeeded → schedule items and invoice status → seat hold converted and items
 *   confirmed once the deposit is covered (instant bookings) → booking status per
 *   `statusAfterPayment`. Payments arriving for bookings that can no longer take them (expired,
 *   cancelled) are recorded and flagged to staff, never silently dropped or applied.
 */
export async function recordVerifiedCharge(
  provider: "paystack" | "mock",
  charge: VerifiedCharge,
  via: "webhook" | "api_verify",
): Promise<RecordResult> {
  if (charge.status !== "success") return { kind: "not_successful", status: charge.status };

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.reference, charge.reference))
      .for("update");
    if (!attempt) {
      logger.warn({ provider, reference: charge.reference }, "Verified charge for unknown payment reference");
      return { kind: "unknown_reference" as const };
    }
    if (attempt.provider !== provider) return { kind: "rejected" as const, reason: "provider_mismatch" };
    if (charge.currency !== attempt.currency.trim()) {
      logger.error({ attemptId: attempt.id }, "Charge currency differs from the payment attempt");
      return { kind: "rejected" as const, reason: "currency_mismatch" };
    }

    const booking = await lockBooking(tx, attempt.bookingId);
    if (!booking) return { kind: "rejected" as const, reason: "booking_missing" };

    const [txn] = await tx
      .insert(transactions)
      .values({
        paymentAttemptId: attempt.id,
        bookingId: booking.id,
        provider,
        providerReference: charge.reference,
        kind: "charge",
        status: "succeeded",
        amountMinor: charge.amountMinor,
        currency: charge.currency,
        channel: charge.channel,
        paidAt: charge.paidAt,
        verifiedVia: via,
        rawPayload: charge.safePayload,
      })
      .onConflictDoNothing({ target: [transactions.provider, transactions.providerReference, transactions.kind] })
      .returning({ id: transactions.id });
    if (!txn) return { kind: "duplicate" as const, bookingId: booking.id };

    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, attempt.invoiceId));
    await tx.insert(ledgerEntries).values({
      bookingId: booking.id,
      invoiceId: attempt.invoiceId,
      transactionId: txn.id,
      entryType: "payment_received",
      amountMinor: -charge.amountMinor,
      currency: charge.currency,
      memo: `Payment ${charge.reference} received${charge.channel ? ` (${charge.channel})` : ""}`,
    });

    const paid = booking.paidMinor + charge.amountMinor;
    await tx.update(bookings).set({ paidMinor: paid }).where(eq(bookings.id, booking.id));
    await tx.update(paymentAttempts).set({ status: "succeeded" }).where(eq(paymentAttempts.id, attempt.id));

    if (charge.amountMinor !== attempt.amountMinor) {
      await tx.insert(bookingNotes).values({
        bookingId: booking.id,
        visibility: "internal",
        body: `Payment ${charge.reference}: provider confirmed ${charge.amountMinor} minor units, attempt was for ${attempt.amountMinor}. Check before taking action.`,
      });
    }

    // Mark schedule items paid in order while the cumulative amount covers them.
    if (invoice) {
      const items = await tx
        .select()
        .from(paymentScheduleItems)
        .where(eq(paymentScheduleItems.invoiceId, invoice.id))
        .orderBy(asc(paymentScheduleItems.position));
      let covered = 0n;
      for (const item of items) {
        covered += item.amountMinor;
        if (item.status !== "paid" && paid >= covered) {
          await tx.update(paymentScheduleItems).set({ status: "paid" }).where(eq(paymentScheduleItems.id, item.id));
        }
      }
      await tx
        .update(invoices)
        .set({ status: paid >= invoice.totalMinor ? "paid" : "partially_paid" })
        .where(and(eq(invoices.id, invoice.id), sql`${invoices.status} <> 'void'`));
    }

    if (!PAYABLE.has(booking.status as BookingStatus)) {
      await tx.insert(bookingNotes).values({
        bookingId: booking.id,
        visibility: "internal",
        body: `Payment ${charge.reference} received while the booking was "${booking.status}". Review and refund or reinstate.`,
      });
      logger.warn(
        { bookingId: booking.id, status: booking.status },
        "Payment received for a booking that can't take payments",
      );
      return {
        kind: "recorded" as const,
        bookingId: booking.id,
        transactionId: txn.id,
        status: booking.status as BookingStatus,
        amountMinor: charge.amountMinor,
      };
    }

    // Instant bookings: the deposit secures the held seats.
    if (paid >= booking.depositMinor) {
      await convertHold(tx, booking.id);
      await tx
        .update(bookingItems)
        .set({ confirmationStatus: "confirmed" })
        .where(and(eq(bookingItems.bookingId, booking.id), eq(bookingItems.confirmationStatus, "held")));
    }
    const items = await tx
      .select({ s: bookingItems.confirmationStatus })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, booking.id));
    const allItemsConfirmed = items.length > 0 && items.every((i) => i.s === "confirmed");

    const next = statusAfterPayment({
      type: booking.type,
      current: booking.status as BookingStatus,
      paidMinor: paid,
      depositMinor: booking.depositMinor,
      totalMinor: booking.totalMinor,
      allItemsConfirmed,
    });
    const row = { id: booking.id, type: booking.type, status: booking.status as BookingStatus };
    if (next !== row.status) {
      await applyTransition(tx, row, next, { type: "provider" }, `Payment ${charge.reference} verified via ${via}`, {
        // A secured booking no longer lapses.
        expiresAt: null,
      });
    } else if (paid > 0n) {
      await tx.update(bookings).set({ expiresAt: null }).where(eq(bookings.id, booking.id));
    }

    if (paid > booking.totalMinor) {
      await tx
        .insert(bookingNotes)
        .values({
          bookingId: booking.id,
          visibility: "internal",
          body: "Paid more than the booking total. Review for refund.",
        });
    }

    logger.info({ bookingId: booking.id, status: row.status, via }, "Payment recorded");
    return {
      kind: "recorded" as const,
      bookingId: booking.id,
      transactionId: txn.id,
      status: row.status,
      amountMinor: charge.amountMinor,
    };
  });
}
