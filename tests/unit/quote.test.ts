import { describe, expect, it } from "vitest";
import type { PriceRuleInput } from "@/server/services/pricing/from-price";
import { computeQuote, type QuoteContext, QuoteError } from "@/server/services/pricing/quote";

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

const ctx = (over: Partial<QuoteContext> = {}): QuoteContext => ({
  package: { minPax: 1, maxPax: 12 },
  options: [
    { id: "twin", kind: "room", name: "Twin room", pricingBasis: "per_person", occupancy: 2 },
    { id: "sgl", kind: "room", name: "Single room", pricingBasis: "per_person", occupancy: 1 },
    { id: "dhow", kind: "addon", name: "Dhow cruise", pricingBasis: "per_person", occupancy: null },
  ],
  rules: [
    rule({ optionId: "twin", amountMinor: 165_000_000n }),
    rule({ optionId: "twin", travellerType: "child", amountMinor: 98_000_000n }),
    rule({ optionId: "sgl", amountMinor: 228_000_000n }),
    rule({ optionId: "dhow", amountMinor: 6_500_000n }),
  ],
  fees: [],
  plan: { depositBasisPoints: 3000, depositMinMinor: null, balanceDueDaysBefore: 45 },
  departure: {
    id: "d1",
    startDate: "2027-01-20",
    endDate: "2027-01-26",
    status: "open",
    bookingDeadline: null,
    capacity: 12,
    seatsHeld: 0,
    seatsConfirmed: 0,
  },
  today: "2026-10-19",
  ...over,
});

describe("computeQuote", () => {
  it("prices rooms per traveller, add-ons, deposit and balance date", () => {
    const q = computeQuote(ctx(), {
      departureId: "d1",
      rooms: [{ optionId: "twin", adults: 2, children: 1 }],
      addons: [{ optionId: "dhow", travellers: 2 }],
    });
    expect(q.lines.map((l) => [l.description, l.quantity, l.totalMinor])).toEqual([
      ["Twin room, adult", 2, 330_000_000n],
      ["Twin room, child", 1, 98_000_000n],
      ["Dhow cruise", 2, 13_000_000n],
    ]);
    expect(q.totalMinor).toBe(441_000_000n);
    expect(q.depositMinor).toBe(132_300_000n); // 30%
    expect(q.balanceDueDate).toBe("2026-12-06"); // 45 days before departure
    expect({ adults: q.adults, children: q.children }).toEqual({ adults: 2, children: 1 });
  });

  it("groups identical rooms into one line", () => {
    const q = computeQuote(ctx(), {
      departureId: "d1",
      rooms: [
        { optionId: "twin", adults: 2, children: 0 },
        { optionId: "twin", adults: 2, children: 0 },
      ],
      addons: [],
    });
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]).toMatchObject({ quantity: 4, totalMinor: 660_000_000n });
  });

  it("charges the full amount inside the balance-due window", () => {
    const q = computeQuote(ctx({ today: "2026-12-10" }), {
      departureId: "d1",
      rooms: [{ optionId: "sgl", adults: 1, children: 0 }],
      addons: [],
    });
    expect(q.depositMinor).toBe(q.totalMinor);
    expect(q.balanceDueDate).toBeNull();
  });

  it("applies percentage fees, fixed fees and tax with banker's rounding", () => {
    const q = computeQuote(
      ctx({
        fees: [
          {
            code: "SVC",
            name: "Service fee",
            kind: "fixed",
            amountMinor: 500_000n,
            currency: "NGN",
            basisPoints: null,
            isTax: false,
            isMandatory: true,
            isActive: true,
          },
          {
            code: "VAT",
            name: "VAT on service",
            kind: "percent",
            amountMinor: null,
            currency: null,
            basisPoints: 750,
            isTax: true,
            isMandatory: true,
            isActive: true,
          },
          {
            code: "OFF",
            name: "Inactive",
            kind: "fixed",
            amountMinor: 1n,
            currency: "NGN",
            basisPoints: null,
            isTax: false,
            isMandatory: true,
            isActive: false,
          },
        ],
      }),
      { departureId: "d1", rooms: [{ optionId: "sgl", adults: 1, children: 0 }], addons: [] },
    );
    expect(q.feesMinor).toBe(500_000n);
    expect(q.taxMinor).toBe(17_100_000n); // 7.5% of 228,000,000
    expect(q.totalMinor).toBe(228_000_000n + 500_000n + 17_100_000n);
  });

  it("applies the deposit minimum", () => {
    const q = computeQuote(
      ctx({ plan: { depositBasisPoints: 1000, depositMinMinor: 50_000_000n, balanceDueDaysBefore: 45 } }),
      {
        departureId: "d1",
        rooms: [{ optionId: "sgl", adults: 1, children: 0 }],
        addons: [],
      },
    );
    expect(q.depositMinor).toBe(50_000_000n);
  });

  it.each([
    [
      "DEPARTURE_UNAVAILABLE",
      { departureId: "other", rooms: [{ optionId: "twin", adults: 1, children: 0 }], addons: [] },
    ],
    ["INVALID_ROOM", { departureId: "d1", rooms: [], addons: [] }],
    ["INVALID_ROOM", { departureId: "d1", rooms: [{ optionId: "twin", adults: 3, children: 0 }], addons: [] }],
    ["INVALID_ROOM", { departureId: "d1", rooms: [{ optionId: "twin", adults: 0, children: 1 }], addons: [] }],
    ["INVALID_ROOM", { departureId: "d1", rooms: [{ optionId: "dhow", adults: 1, children: 0 }], addons: [] }],
    [
      "INVALID_ADDON",
      {
        departureId: "d1",
        rooms: [{ optionId: "sgl", adults: 1, children: 0 }],
        addons: [{ optionId: "dhow", travellers: 2 }],
      },
    ],
    [
      "INVALID_ADDON",
      {
        departureId: "d1",
        rooms: [{ optionId: "sgl", adults: 1, children: 0 }],
        addons: [{ optionId: "twin", travellers: 1 }],
      },
    ],
    ["PRICE_ON_REQUEST", { departureId: "d1", rooms: [{ optionId: "sgl", adults: 1, children: 1 }], addons: [] }],
  ] as const)("rejects with %s", (code, sel) => {
    expect(() => computeQuote(ctx(), sel as never)).toThrowError(expect.objectContaining({ code }));
  });

  it("enforces seats remaining and pax limits", () => {
    const tight = ctx({ departure: { ...ctx().departure, seatsHeld: 10, seatsConfirmed: 1 } });
    expect(() =>
      computeQuote(tight, { departureId: "d1", rooms: [{ optionId: "twin", adults: 2, children: 0 }], addons: [] }),
    ).toThrow(QuoteError);
    expect(() =>
      computeQuote(ctx({ package: { minPax: 2, maxPax: 12 } }), {
        departureId: "d1",
        rooms: [{ optionId: "sgl", adults: 1, children: 0 }],
        addons: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "PAX_OUT_OF_RANGE" }));
  });
});
