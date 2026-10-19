import { describe, expect, it } from "vitest";
import { calculateCancellation, cancellationRulesSchema, daysBetween } from "@/server/services/booking/cancellation";
import {
  TRANSITIONS,
  assertTransition,
  canTransition,
  statusAfterPayment,
  type BookingStatus,
} from "@/server/services/booking/transitions";

describe("booking transitions", () => {
  it("allows the documented happy paths", () => {
    expect(canTransition("package", "draft", "awaiting_payment", "system")).toBe(true);
    expect(canTransition("package", "draft", "request_submitted", "customer")).toBe(true);
    expect(canTransition("package", "request_submitted", "awaiting_payment", "staff")).toBe(true);
    expect(canTransition("package", "awaiting_payment", "partially_paid", "provider")).toBe(true);
    expect(canTransition("package", "partially_paid", "confirmed", "provider")).toBe(true);
    expect(canTransition("package", "confirmed", "cancellation_requested", "customer")).toBe(true);
    expect(canTransition("package", "cancelled", "refund_pending", "staff")).toBe(true);
  });

  it("blocks the wrong actor or skipped steps", () => {
    expect(canTransition("package", "request_submitted", "awaiting_payment", "customer")).toBe(false);
    expect(canTransition("package", "draft", "confirmed", "system")).toBe(false);
    expect(canTransition("package", "cancellation_requested", "cancelled", "customer")).toBe(false);
    expect(canTransition("package", "cancelled", "refund_pending", "customer")).toBe(false);
    expect(() => assertTransition("package", "completed", "cancelled", "staff")).toThrow(/cannot move/);
  });

  it("respects booking type restrictions", () => {
    expect(canTransition("service", "awaiting_payment", "partially_paid", "provider")).toBe(false);
    expect(canTransition("hotel", "confirmed", "ticketed", "staff")).toBe(false);
    expect(canTransition("flight", "draft", "request_submitted", "customer")).toBe(false);
  });

  it("has no transitions out of terminal states", () => {
    for (const s of ["completed", "refunded", "failed", "expired"] as BookingStatus[])
      expect(TRANSITIONS[s]).toEqual([]);
  });

  it("derives the status after a verified payment", () => {
    const base = {
      type: "package" as const,
      current: "awaiting_payment" as const,
      depositMinor: 30n,
      totalMinor: 100n,
      allItemsConfirmed: true,
    };
    expect(statusAfterPayment({ ...base, paidMinor: 10n })).toBe("partially_paid");
    expect(statusAfterPayment({ ...base, paidMinor: 30n })).toBe("confirmed");
    expect(statusAfterPayment({ ...base, paidMinor: 100n })).toBe("confirmed");
    expect(statusAfterPayment({ ...base, paidMinor: 100n, allItemsConfirmed: false })).toBe("partially_paid");
    expect(statusAfterPayment({ ...base, type: "service", paidMinor: 10n })).toBe("awaiting_payment");
    expect(statusAfterPayment({ ...base, current: "confirmed", paidMinor: 100n })).toBe("confirmed");
  });
});

describe("cancellation charges", () => {
  const rules = cancellationRulesSchema.parse({
    tiers: [
      { minDaysBeforeDeparture: 61, penalty: { kind: "deposit" } },
      { minDaysBeforeDeparture: 30, penalty: { kind: "percent", basisPoints: 5000 } },
      { minDaysBeforeDeparture: 0, penalty: { kind: "percent", basisPoints: 10000 } },
    ],
  });
  const base = {
    rules,
    totalMinor: 1_000_000n,
    depositMinor: 300_000n,
    paidMinor: 300_000n,
    departureDate: "2027-01-20",
  };

  it.each([
    ["2026-10-19", 93, 300_000n, 0n],
    ["2026-11-21", 60, 500_000n, 0n],
    ["2026-12-21", 30, 500_000n, 0n],
    ["2026-12-22", 29, 1_000_000n, 0n],
  ])("on %s (%i days out) charges %s", (today, days, penalty, refundable) => {
    const r = calculateCancellation({ ...base, today });
    expect(r.daysBeforeDeparture).toBe(days);
    expect(r.penaltyMinor).toBe(penalty);
    expect(r.refundableMinor).toBe(refundable);
  });

  it("refunds what was paid above the penalty", () => {
    const r = calculateCancellation({ ...base, paidMinor: 1_000_000n, today: "2026-10-19" });
    expect(r.refundableMinor).toBe(700_000n);
  });

  it("never charges more than the total, and refuses once travel has started", () => {
    const fixed = cancellationRulesSchema.parse({
      tiers: [{ minDaysBeforeDeparture: 0, penalty: { kind: "fixed", amountMinor: 9_999_999 } }],
    });
    expect(calculateCancellation({ ...base, rules: fixed, today: "2026-10-19" }).penaltyMinor).toBe(1_000_000n);
    expect(() => calculateCancellation({ ...base, today: "2027-01-21" })).toThrow(/already started/);
  });

  it("counts calendar days", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});
