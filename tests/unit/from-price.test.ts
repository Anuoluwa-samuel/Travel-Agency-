import { describe, expect, it } from "vitest";
import {
  computeFromPrice,
  isBookableDeparture,
  resolveRule,
  type PriceRuleInput,
} from "@/server/services/pricing/from-price";

const rule = (r: Partial<PriceRuleInput>): PriceRuleInput => ({
  departureId: null,
  optionId: "twin",
  travellerType: "adult",
  amountMinor: 100_000n,
  currency: "NGN",
  validFrom: null,
  validTo: null,
  priority: 0,
  ...r,
});
const dep = (id: string, startDate: string, extra: Partial<Parameters<typeof isBookableDeparture>[0]> = {}) => ({
  id,
  startDate,
  status: "open" as const,
  bookingDeadline: null,
  capacity: 10,
  seatsHeld: 0,
  seatsConfirmed: 0,
  ...extra,
});
const options = [
  { id: "twin", kind: "room" as const, pricingBasis: "per_person" as const },
  { id: "sgl", kind: "room" as const, pricingBasis: "per_person" as const },
  { id: "dhow", kind: "addon" as const, pricingBasis: "per_person" as const },
];
const today = "2026-10-15";

describe("isBookableDeparture", () => {
  it("rejects past, closed, full and past-deadline departures", () => {
    expect(isBookableDeparture(dep("a", "2026-12-01"), today)).toBe(true);
    expect(isBookableDeparture(dep("a", "2026-10-15"), today)).toBe(false);
    expect(isBookableDeparture(dep("a", "2026-12-01", { status: "closed" }), today)).toBe(false);
    expect(isBookableDeparture(dep("a", "2026-12-01", { seatsHeld: 4, seatsConfirmed: 6 }), today)).toBe(false);
    expect(isBookableDeparture(dep("a", "2026-12-01", { bookingDeadline: "2026-10-14" }), today)).toBe(false);
  });
});

describe("resolveRule precedence", () => {
  const d = { id: "d1", startDate: "2026-12-01" };

  it("prefers a departure-specific rule over a general one", () => {
    const r = resolveRule(
      [rule({ amountMinor: 1n, priority: 9 }), rule({ departureId: "d1", amountMinor: 5n })],
      d,
      "twin",
      "adult",
    );
    expect(r?.amountMinor).toBe(5n);
  });

  it("then prefers higher priority", () => {
    const r = resolveRule([rule({ amountMinor: 1n }), rule({ amountMinor: 9n, priority: 2 })], d, "twin", "adult");
    expect(r?.amountMinor).toBe(9n);
  });

  it("breaks ties with the lower amount", () => {
    const r = resolveRule([rule({ amountMinor: 9n }), rule({ amountMinor: 3n })], d, "twin", "adult");
    expect(r?.amountMinor).toBe(3n);
  });

  it("respects validity windows on the departure date", () => {
    const r = resolveRule(
      [rule({ amountMinor: 1n, validTo: "2026-11-30" }), rule({ amountMinor: 7n, validFrom: "2026-12-01" })],
      d,
      "twin",
      "adult",
    );
    expect(r?.amountMinor).toBe(7n);
  });

  it("ignores rules for other departures, options or traveller types", () => {
    expect(resolveRule([rule({ departureId: "other" })], d, "twin", "adult")).toBeNull();
    expect(resolveRule([rule({ optionId: "sgl" })], d, "twin", "adult")).toBeNull();
    expect(resolveRule([rule({ travellerType: "child" })], d, "twin", "adult")).toBeNull();
  });
});

describe("computeFromPrice", () => {
  it("returns the lowest adult room price across bookable departures", () => {
    const m = computeFromPrice({
      rules: [
        rule({ optionId: "twin", amountMinor: 165_000_000n }),
        rule({ optionId: "sgl", amountMinor: 228_000_000n }),
        rule({ optionId: "twin", departureId: "late", amountMinor: 150_000_000n }),
        rule({ optionId: "dhow", amountMinor: 6_500_000n }),
      ],
      options,
      departures: [dep("early", "2026-11-20"), dep("late", "2027-01-10")],
      today,
    });
    expect(m).toEqual({ amountMinor: 150_000_000n, currency: "NGN" });
  });

  it("never uses add-ons or children as the from price", () => {
    const m = computeFromPrice({
      rules: [
        rule({ optionId: "dhow", amountMinor: 1n }),
        rule({ travellerType: "child", amountMinor: 2n }),
        rule({ amountMinor: 50n }),
      ],
      options,
      departures: [dep("d", "2026-12-01")],
      today,
    });
    expect(m?.amountMinor).toBe(50n);
  });

  it("returns null when nothing is bookable", () => {
    expect(computeFromPrice({ rules: [rule({})], options, departures: [dep("d", "2026-01-01")], today })).toBeNull();
    expect(computeFromPrice({ rules: [], options, departures: [dep("d", "2026-12-01")], today })).toBeNull();
  });

  it("skips unsupported currencies", () => {
    expect(
      computeFromPrice({ rules: [rule({ currency: "XXX" })], options, departures: [dep("d", "2026-12-01")], today }),
    ).toBeNull();
  });
});
