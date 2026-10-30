import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
import { bookingStatusHistory, bookings } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { type Actor, type BookingStatus, type BookingType, canTransition } from "./transitions";

export interface BookingRow {
  id: string;
  type: BookingType;
  status: BookingStatus;
}

/**
 * The only way a booking's status changes (state-machines.md intro). Must run inside the
 * transaction that holds the booking row lock. Writes the history row in the same transaction.
 */
export async function applyTransition(
  tx: Tx,
  booking: BookingRow,
  to: BookingStatus,
  actor: { type: Actor; id?: string | null },
  note?: string,
  extra: Partial<typeof bookings.$inferInsert> = {},
) {
  if (!canTransition(booking.type, booking.status, to, actor.type)) {
    throw new AppError("INVALID_TRANSITION", "This booking can't be changed that way right now.", {
      from: booking.status,
      to,
      actor: actor.type,
    });
  }
  await tx
    .update(bookings)
    .set({ status: to, ...extra })
    .where(eq(bookings.id, booking.id));
  await tx.insert(bookingStatusHistory).values({
    bookingId: booking.id,
    fromStatus: booking.status,
    toStatus: to,
    actorType: actor.type,
    actorId: actor.id ?? null,
    note: note ?? null,
  });
  booking.status = to;
}

/** Locks and returns a booking row for update. */
export async function lockBooking(tx: Tx, bookingId: string) {
  const [row] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  return row ?? null;
}
