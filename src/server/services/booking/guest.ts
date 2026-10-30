import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { normalizeReference } from "@/lib/reference";
import { db } from "@/server/db/client";
import { bookings, guestAccessCodes } from "@/server/db/schema";
import { getEmailProvider } from "@/server/integrations/email";
import { hmac, safeEqual } from "@/server/lib/crypto";
import { logger } from "@/server/lib/logger";
import { grantGuestAccess } from "./access";

/*
 * Guest booking lookup (journeys J04). Reference + email → a 6-digit code is emailed to the
 * contact address already on the booking. The response is identical whether or not the pair
 * matched, so the form can't be used to discover bookings. Codes expire after 10 minutes, are
 * single use and lock after 5 wrong guesses.
 */

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

const hashCode = (bookingId: string, code: string) => hmac(`guest-code:${bookingId}:${code}`);

export async function requestGuestCode(reference: string, email: string) {
  const ref = normalizeReference(reference);
  if (!ref) return;
  const [b] = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      contactEmail: bookings.contactEmail,
      contactName: bookings.contactName,
    })
    .from(bookings)
    .where(and(eq(bookings.reference, ref), eq(sql`lower(${bookings.contactEmail})`, email.toLowerCase())));
  if (!b) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const [row] = await db
    .insert(guestAccessCodes)
    .values({ bookingId: b.id, codeHash: hashCode(b.id, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) })
    .returning({ id: guestAccessCodes.id });
  try {
    await getEmailProvider().send({
      to: b.contactEmail,
      subject: `Your ORBIS booking code: ${code}`,
      text: `Hi ${b.contactName.split(" ")[0]},\n\nUse this code to view booking ${b.reference}: ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.\n\n— ORBIS`,
      idempotencyKey: `guest-code:${row.id}`,
    });
  } catch (err) {
    logger.error({ err, bookingId: b.id }, "Guest code email failed");
  }
}

export async function verifyGuestCode(reference: string, code: string): Promise<string | null> {
  const ref = normalizeReference(reference);
  if (!ref) return null;
  const [b] = await db
    .select({ id: bookings.id, reference: bookings.reference })
    .from(bookings)
    .where(eq(bookings.reference, ref));
  if (!b) return null;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(guestAccessCodes)
      .where(
        and(
          eq(guestAccessCodes.bookingId, b.id),
          isNull(guestAccessCodes.consumedAt),
          gt(guestAccessCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(guestAccessCodes.createdAt))
      .limit(1)
      .for("update");
    if (!row || row.attempts >= MAX_ATTEMPTS) return null;
    if (!safeEqual(row.codeHash, hashCode(b.id, code))) {
      await tx
        .update(guestAccessCodes)
        .set({ attempts: row.attempts + 1 })
        .where(eq(guestAccessCodes.id, row.id));
      return null;
    }
    await tx.update(guestAccessCodes).set({ consumedAt: new Date() }).where(eq(guestAccessCodes.id, row.id));
    await grantGuestAccess(b.id);
    return b.reference;
  });
}
