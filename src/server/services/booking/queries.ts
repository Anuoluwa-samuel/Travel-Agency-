import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  bookingItems,
  bookingStatusHistory,
  bookingTravellers,
  bookings,
  cancellationRequests,
  invoices,
  packages,
  paymentScheduleItems,
  policies,
  transactions,
} from "@/server/db/schema";

/**
 * Everything the booking page shows, for a viewer already authorised by access.ts. Passport
 * numbers are never decrypted here: only the last four characters are returned.
 */
export async function getBookingDetail(bookingId: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b) return null;
  const [pkg] = b.packageId
    ? await db
        .select({ slug: packages.slug, title: packages.title, bookingMode: packages.bookingMode })
        .from(packages)
        .where(eq(packages.id, b.packageId))
    : [];
  const [items, travellers, history, invoiceRows, txns, cancellations, policy] = await Promise.all([
    db.select().from(bookingItems).where(eq(bookingItems.bookingId, b.id)),
    db
      .select({
        type: bookingTravellers.travellerType,
        firstName: bookingTravellers.firstName,
        lastName: bookingTravellers.lastName,
        passportLast4: bookingTravellers.passportLast4,
        hasDateOfBirth: bookingTravellers.dateOfBirthEnc,
        isLead: bookingTravellers.isLead,
      })
      .from(bookingTravellers)
      .where(eq(bookingTravellers.bookingId, b.id))
      .orderBy(asc(bookingTravellers.position)),
    db
      .select({ to: bookingStatusHistory.toStatus, at: bookingStatusHistory.createdAt })
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, b.id))
      .orderBy(asc(bookingStatusHistory.createdAt)),
    db.select().from(invoices).where(eq(invoices.bookingId, b.id)).orderBy(desc(invoices.issuedAt)),
    db
      .select({
        reference: transactions.providerReference,
        amountMinor: transactions.amountMinor,
        paidAt: transactions.paidAt,
        channel: transactions.channel,
        kind: transactions.kind,
        provider: transactions.provider,
      })
      .from(transactions)
      .where(eq(transactions.bookingId, b.id))
      .orderBy(asc(transactions.createdAt)),
    db
      .select()
      .from(cancellationRequests)
      .where(eq(cancellationRequests.bookingId, b.id))
      .orderBy(desc(cancellationRequests.createdAt)),
    b.cancellationPolicyId
      ? db
          .select({ title: policies.title, body: policies.body })
          .from(policies)
          .where(eq(policies.id, b.cancellationPolicyId))
      : Promise.resolve([]),
  ]);
  const invoice = invoiceRows.find((i) => i.status !== "void") ?? null;
  const schedule = invoice
    ? await db
        .select()
        .from(paymentScheduleItems)
        .where(eq(paymentScheduleItems.invoiceId, invoice.id))
        .orderBy(asc(paymentScheduleItems.position))
    : [];
  return {
    booking: b,
    pkg: pkg ?? null,
    items,
    travellers: travellers.map((t) => ({ ...t, hasDateOfBirth: Boolean(t.hasDateOfBirth) })),
    history,
    invoice,
    schedule,
    transactions: txns,
    cancellation: cancellations[0] ?? null,
    policy: policy[0] ?? null,
  };
}

export async function listBookingsForUser(userId: string) {
  return db
    .select({
      reference: bookings.reference,
      status: bookings.status,
      totalMinor: bookings.totalMinor,
      balanceMinor: bookings.balanceMinor,
      currency: bookings.currency,
      travelStart: bookings.travelStart,
      travelEnd: bookings.travelEnd,
      title: packages.title,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .leftJoin(packages, eq(packages.id, bookings.packageId))
    .where(
      and(
        eq(bookings.customerUserId, userId),
        inArray(bookings.status, [
          "request_submitted",
          "awaiting_supplier",
          "awaiting_payment",
          "partially_paid",
          "confirmed",
          "ticketed",
          "in_progress",
          "completed",
          "cancellation_requested",
          "cancelled",
          "refund_pending",
          "refunded",
          "failed",
          "expired",
        ]),
      ),
    )
    .orderBy(desc(bookings.createdAt));
}
