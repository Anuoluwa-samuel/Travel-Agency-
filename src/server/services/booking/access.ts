import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { normalizeReference } from "@/lib/reference";
import { db } from "@/server/db/client";
import { bookings } from "@/server/db/schema";
import { getCurrentUser, getStaffRoles } from "@/server/auth/session";
import { permissionsForRoles } from "@/server/auth/permissions";
import { hmac, safeEqual } from "@/server/lib/crypto";

/*
 * Who may see a booking (journeys J03/J04, RULES §4):
 *   - the signed-in customer who owns it,
 *   - a guest holding a signed, short-lived grant for that booking (set after creating it, or
 *     after proving control of the contact email with a one-time code),
 *   - staff with booking.read.
 * A reference alone is never enough. Everyone else gets "not found".
 */

const COOKIE = "orbis_guest";
export const GUEST_GRANT_TTL_MS = 2 * 60 * 60_000;

function sign(payload: string) {
  return hmac(`guest:${payload}`);
}

/** Grants are a comma-separated list of `bookingId.expiresMs.signature`, at most 5 bookings. */
async function readGrants(): Promise<Map<string, number>> {
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const out = new Map<string, number>();
  for (const part of raw.split(",")) {
    const [id, exp, sig] = part.split(".");
    if (!id || !exp || !sig) continue;
    const expMs = Number(exp);
    if (!Number.isFinite(expMs) || expMs < Date.now()) continue;
    if (safeEqual(sig, sign(`${id}.${exp}`))) out.set(id, expMs);
  }
  return out;
}

export async function grantGuestAccess(bookingId: string) {
  const grants = await readGrants();
  grants.set(bookingId, Date.now() + GUEST_GRANT_TTL_MS);
  const value = [...grants.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, exp]) => `${id}.${exp}.${sign(`${id}.${exp}`)}`)
    .join(",");
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_GRANT_TTL_MS / 1000,
  });
}

export type Viewer = { kind: "owner"; userId: string } | { kind: "guest" } | { kind: "staff"; userId: string };

export async function getBookingForViewer(reference: string) {
  const ref = normalizeReference(reference);
  if (!ref || !ref.startsWith("BK-")) return null;
  const [booking] = await db.select().from(bookings).where(eq(bookings.reference, ref));
  if (!booking) return null;

  const user = await getCurrentUser();
  if (user && booking.customerUserId === user.id)
    return { booking, viewer: { kind: "owner", userId: user.id } as Viewer };
  const grants = await readGrants();
  if (grants.has(booking.id)) return { booking, viewer: { kind: "guest" } as Viewer };
  if (user) {
    const perms = permissionsForRoles(await getStaffRoles(user.id));
    if (perms.has("booking.read")) return { booking, viewer: { kind: "staff", userId: user.id } as Viewer };
  }
  return null;
}
