import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { bookingNotes, bookings, cancellationRequests, policies } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import { calculateCancellation, cancellationRulesSchema, type CancellationResult } from "./cancellation";
import { todayIso } from "./context";
import { applyTransition, lockBooking } from "./state";
import { CANCELLABLE, type BookingStatus } from "./transitions";

/** Shows the charges before the customer commits (journeys J17). */
export async function previewCancellation(bookingId: string, now = new Date()) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b || !CANCELLABLE.has(b.status as BookingStatus) || !b.travelStart) return null;
  const rules = await loadRules(b.cancellationPolicyId);
  if (!rules) return { manualReview: true as const };
  if (todayIso(now) >= b.travelStart) return null;
  const result = calculateCancellation({
    rules,
    totalMinor: b.totalMinor,
    depositMinor: b.depositMinor,
    paidMinor: b.paidMinor,
    departureDate: b.travelStart,
    today: todayIso(now),
  });
  return { manualReview: false as const, currency: b.currency.trim(), result };
}

async function loadRules(policyId: string | null) {
  if (!policyId) return null;
  const [p] = await db.select({ rules: policies.rules }).from(policies).where(eq(policies.id, policyId));
  const parsed = cancellationRulesSchema.safeParse(p?.rules);
  return parsed.success ? parsed.data : null;
}

/**
 * Customer asks to cancel. The charge is calculated from the policy accepted at booking and
 * frozen on the request; staff then approve (cancel + refund) or reject it in the admin area.
 */
export async function requestCancellation(
  bookingId: string,
  input: { reason: string; actor: { type: "customer" | "staff"; id: string | null } },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (!b) throw new AppError("NOT_FOUND", "That booking could not be found.");
    if (!CANCELLABLE.has(b.status as BookingStatus)) {
      throw new AppError("CONFLICT", "This booking can't be cancelled online. Please contact us.");
    }
    if (!b.travelStart || todayIso(now) >= b.travelStart) {
      throw new AppError("CONFLICT", "Travel has started, so changes need to go through our team.");
    }
    const rules = await loadRules(b.cancellationPolicyId);
    let calc: CancellationResult | null = null;
    if (rules) {
      calc = calculateCancellation({
        rules,
        totalMinor: b.totalMinor,
        depositMinor: b.depositMinor,
        paidMinor: b.paidMinor,
        departureDate: b.travelStart,
        today: todayIso(now),
      });
    }

    const open = await tx
      .select({ id: cancellationRequests.id })
      .from(cancellationRequests)
      .where(and(eq(cancellationRequests.bookingId, b.id), eq(cancellationRequests.status, "submitted")));
    if (open[0]) throw new AppError("CONFLICT", "A cancellation request is already being reviewed.");

    await tx.insert(cancellationRequests).values({
      bookingId: b.id,
      requestedBy: input.actor.id,
      requestedByType: input.actor.type,
      previousStatus: b.status,
      reason: input.reason,
      currency: b.currency,
      penaltyMinor: calc?.penaltyMinor ?? 0n,
      refundableMinor: calc?.refundableMinor ?? 0n,
      calculation: calc
        ? {
            policyId: b.cancellationPolicyId,
            rules,
            daysBeforeDeparture: calc.daysBeforeDeparture,
            tier: calc.tier,
            totalMinor: b.totalMinor.toString(),
            paidMinor: b.paidMinor.toString(),
            depositMinor: b.depositMinor.toString(),
            calculatedOn: todayIso(now),
          }
        : { manualReview: true, reason: "No structured cancellation rules on the policy" },
    });
    if (!calc) {
      await tx
        .insert(bookingNotes)
        .values({
          bookingId: b.id,
          visibility: "internal",
          body: "Cancellation requested; the policy has no structured rules, so charges need manual review.",
        });
    }
    await applyTransition(
      tx,
      { id: b.id, type: b.type, status: b.status as BookingStatus },
      "cancellation_requested",
      input.actor,
      input.reason,
    );
    return {
      penaltyMinor: calc?.penaltyMinor ?? null,
      refundableMinor: calc?.refundableMinor ?? null,
      currency: b.currency.trim(),
    };
  });
}
