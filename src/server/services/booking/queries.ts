import "server-only";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import {
  bookingItems,
  bookingStatusHistory,
  bookingTravellers,
  bookings,
  cancellationRequests,
  invoices,
  packageDepartures,
  packageOptions,
  packages,
  paymentScheduleItems,
  policies,
  transactions,
} from "@/server/db/schema";
import { isBookableDeparture } from "@/server/services/pricing/from-price";

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

/**
 * Live (uncached) choices for the booking wizard: rooms, extras and departures with their
 * availability right now. The catalogue pages may be cached for hours; booking must not be.
 */
export async function getBookingOptions(packageSlug: string, now = new Date()) {
  const [pkg] = await db
    .select({
      id: packages.id,
      slug: packages.slug,
      title: packages.title,
      bookingMode: packages.bookingMode,
      maxPax: packages.maxPax,
      durationDays: packages.durationDays,
      cancellationPolicyId: packages.cancellationPolicyId,
    })
    .from(packages)
    .where(
      and(eq(packages.slug, packageSlug), eq(packages.status, "published"), lte(packages.publishedAt, sql`now()`)),
    );
  if (!pkg) return null;

  const today = now.toISOString().slice(0, 10);
  const [opts, deps, policy] = await Promise.all([
    db.select().from(packageOptions).where(eq(packageOptions.packageId, pkg.id)).orderBy(asc(packageOptions.position)),
    db
      .select()
      .from(packageDepartures)
      .where(eq(packageDepartures.packageId, pkg.id))
      .orderBy(asc(packageDepartures.startDate)),
    pkg.cancellationPolicyId
      ? db
          .select({ title: policies.title, body: policies.body })
          .from(policies)
          .where(eq(policies.id, pkg.cancellationPolicyId))
      : Promise.resolve([]),
  ]);

  return {
    ...pkg,
    rooms: opts.filter((o) => o.kind === "room").map((o) => ({ id: o.id, name: o.name, occupancy: o.occupancy })),
    addons: opts.filter((o) => o.kind === "addon").map((o) => ({ id: o.id, name: o.name })),
    departures: deps
      .filter((d) => d.startDate > today && d.status !== "cancelled")
      .map((d) => {
        const remaining = d.capacity - d.seatsHeld - d.seatsConfirmed;
        const bookable = isBookableDeparture(d, today);
        return {
          id: d.id,
          startDate: d.startDate,
          endDate: d.endDate,
          availability: !bookable
            ? ("closed" as const)
            : remaining <= 4 || d.status === "limited"
              ? ("limited" as const)
              : ("open" as const),
        };
      }),
    cancellationPolicy: policy[0] ?? null,
  };
}
