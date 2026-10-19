import { z } from "zod";

/**
 * Cancellation charges from a policy's structured rules (policies.rules, kind = cancellation).
 * Pure and deterministic; the result and its inputs are frozen on the cancellation request so
 * a later policy change never alters an earlier decision.
 *
 * Tiers are matched on whole days between the cancellation date and departure (both in UTC
 * calendar days). The first tier whose `minDaysBeforeDeparture` is ≤ the days remaining applies.
 * Penalty kinds:
 *   - deposit: the booking's deposit amount (capped at the total)
 *   - percent: basis points of the booking total
 *   - fixed:   a fixed minor-unit amount
 * The penalty never exceeds the total; the refundable amount is what was paid minus the
 * penalty, never below zero.
 */

export const cancellationRulesSchema = z.object({
  tiers: z
    .array(
      z.object({
        minDaysBeforeDeparture: z.number().int().min(0),
        penalty: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("deposit") }),
          z.object({ kind: z.literal("percent"), basisPoints: z.number().int().min(0).max(10_000) }),
          z.object({ kind: z.literal("fixed"), amountMinor: z.coerce.bigint().nonnegative() }),
        ]),
      }),
    )
    .min(1),
});

export type CancellationRules = z.infer<typeof cancellationRulesSchema>;

export interface CancellationInput {
  rules: CancellationRules;
  totalMinor: bigint;
  depositMinor: bigint;
  paidMinor: bigint;
  departureDate: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
}

export interface CancellationResult {
  daysBeforeDeparture: number;
  tier: CancellationRules["tiers"][number];
  penaltyMinor: bigint;
  refundableMinor: bigint;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function calculateCancellation(input: CancellationInput): CancellationResult {
  const days = daysBetween(input.today, input.departureDate);
  if (days < 0) throw new Error("Travel has already started; cancellation charges must be reviewed by staff.");
  const tiers = [...input.rules.tiers].sort((a, b) => b.minDaysBeforeDeparture - a.minDaysBeforeDeparture);
  const tier = tiers.find((t) => days >= t.minDaysBeforeDeparture) ?? tiers[tiers.length - 1];

  let penalty: bigint;
  switch (tier.penalty.kind) {
    case "deposit":
      penalty = input.depositMinor;
      break;
    case "percent":
      // Round in the customer's favour.
      penalty = (input.totalMinor * BigInt(tier.penalty.basisPoints)) / 10_000n;
      break;
    case "fixed":
      penalty = tier.penalty.amountMinor;
      break;
  }
  if (penalty > input.totalMinor) penalty = input.totalMinor;
  const refundable = input.paidMinor > penalty ? input.paidMinor - penalty : 0n;
  return { daysBeforeDeparture: days, tier, penaltyMinor: penalty, refundableMinor: refundable };
}
