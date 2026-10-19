import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { bookingItems, bookings, inventoryHolds, invoices, packageDepartures } from "@/server/db/schema";
import { logger } from "@/server/lib/logger";
import { applyTransition, lockBooking } from "./state";

/**
 * Expires unpaid instant bookings and unanswered requests whose hold has lapsed, releasing their
 * seats (state-machines §1: awaiting_payment → expired, request_submitted → expired).
 * Bookings with any money received are never expired automatically: staff review them.
 *
 * Safe to run concurrently: each booking is handled in its own transaction with a row lock.
 */
export async function releaseExpiredHolds(now = new Date()): Promise<{ expired: string[] }> {
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["awaiting_payment", "request_submitted"]),
        lt(bookings.expiresAt, now),
        eq(bookings.paidMinor, 0n),
      ),
    )
    .limit(200);

  const expired: string[] = [];
  for (const { id } of candidates) {
    const done = await db.transaction(async (tx) => {
      const b = await lockBooking(tx, id);
      if (
        !b ||
        !["awaiting_payment", "request_submitted"].includes(b.status) ||
        !b.expiresAt ||
        b.expiresAt >= now ||
        b.paidMinor > 0n
      ) {
        return false;
      }
      await releaseHold(tx, id);
      await tx.update(bookingItems).set({ confirmationStatus: "cancelled" }).where(eq(bookingItems.bookingId, id));
      await tx.update(invoices).set({ status: "void" }).where(eq(invoices.bookingId, id));
      await applyTransition(
        tx,
        { id, type: b.type, status: b.status },
        "expired",
        { type: "system" },
        "Hold expired without payment",
      );
      return true;
    });
    if (done) expired.push(id);
  }
  if (expired.length) logger.info({ count: expired.length }, "Expired unpaid bookings");
  return { expired };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Returns held seats to the departure. Idempotent: only an active hold is released. */
export async function releaseHold(tx: Tx, bookingId: string) {
  const [hold] = await tx
    .update(inventoryHolds)
    .set({ status: "released" })
    .where(and(eq(inventoryHolds.bookingId, bookingId), eq(inventoryHolds.status, "held")))
    .returning();
  if (!hold) return;
  await tx
    .update(packageDepartures)
    .set({ seatsHeld: sql`${packageDepartures.seatsHeld} - ${hold.seats}` })
    .where(eq(packageDepartures.id, hold.departureId));
}

/** Moves held seats to confirmed when a booking is secured. Idempotent. */
export async function convertHold(tx: Tx, bookingId: string) {
  const [hold] = await tx
    .update(inventoryHolds)
    .set({ status: "converted" })
    .where(and(eq(inventoryHolds.bookingId, bookingId), eq(inventoryHolds.status, "held")))
    .returning();
  if (!hold) return;
  await tx
    .update(packageDepartures)
    .set({
      seatsHeld: sql`${packageDepartures.seatsHeld} - ${hold.seats}`,
      seatsConfirmed: sql`${packageDepartures.seatsConfirmed} + ${hold.seats}`,
    })
    .where(eq(packageDepartures.id, hold.departureId));
}
