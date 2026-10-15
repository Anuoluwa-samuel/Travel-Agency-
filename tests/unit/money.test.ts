import { describe, expect, it } from "vitest";
import {
  CurrencyMismatchError,
  add,
  allocate,
  convert,
  divRound,
  formatMoney,
  fromJSON,
  fromMajor,
  money,
  multiply,
  percentOf,
  subtract,
  sum,
  toJSON,
  toMajorString,
} from "@/lib/money";

const ngn = (n: bigint) => money(n, "NGN");

describe("money arithmetic", () => {
  it("adds and subtracts in minor units", () => {
    expect(add(ngn(150n), ngn(250n)).amountMinor).toBe(400n);
    expect(subtract(ngn(150n), ngn(250n)).amountMinor).toBe(-100n);
  });

  it("refuses to mix currencies", () => {
    expect(() => add(ngn(1n), money(1n, "USD"))).toThrow(CurrencyMismatchError);
  });

  it("sums an empty list to zero in the requested currency", () => {
    expect(sum([], "GBP")).toEqual(money(0n, "GBP"));
  });

  it("multiplies by integer quantities exactly and rejects fractions", () => {
    expect(multiply(ngn(165_000_000n), 3).amountMinor).toBe(495_000_000n);
    expect(() => multiply(ngn(1n), 1.5)).toThrow(RangeError);
  });

  it("rejects unsafe JS numbers", () => {
    expect(() => money(2 ** 60, "NGN")).toThrow(RangeError);
  });
});

describe("rounding", () => {
  it.each([
    [5n, 2n, "half-even", 2n],
    [7n, 2n, "half-even", 4n],
    [5n, 2n, "half-up", 3n],
    [5n, 2n, "down", 2n],
    [5n, 2n, "up", 3n],
    [-5n, 2n, "half-even", -2n],
    [-7n, 2n, "half-up", -4n],
    [10n, 3n, "half-even", 3n],
  ] as const)("divRound(%s, %s, %s) = %s", (n, d, mode, expected) => {
    expect(divRound(n, d, mode)).toBe(expected);
  });

  it("computes VAT at 7.5% with banker's rounding", () => {
    // 7.5% of ₦1,000.10 = ₦75.0075 → 7500.75 kobo → 7501 kobo
    expect(percentOf(ngn(100_010n), 750).amountMinor).toBe(7_501n);
  });

  it("computes a 30% deposit", () => {
    expect(percentOf(ngn(495_000_000n), 3000).amountMinor).toBe(148_500_000n);
  });
});

describe("allocate", () => {
  it("never loses or invents minor units", () => {
    const parts = allocate(ngn(100n), [1, 1, 1]);
    expect(parts.map((p) => p.amountMinor)).toEqual([34n, 33n, 33n]);
    expect(sum(parts, "NGN").amountMinor).toBe(100n);
  });

  it("respects weights and zero weights", () => {
    const parts = allocate(ngn(1_000n), [3, 0, 1]);
    expect(parts.map((p) => p.amountMinor)).toEqual([750n, 0n, 250n]);
  });

  it("handles negative amounts symmetrically", () => {
    const parts = allocate(ngn(-100n), [1, 1, 1]);
    expect(sum(parts, "NGN").amountMinor).toBe(-100n);
  });

  it("rejects invalid weights", () => {
    expect(() => allocate(ngn(1n), [])).toThrow();
    expect(() => allocate(ngn(1n), [0, 0])).toThrow();
    expect(() => allocate(ngn(1n), [1.5])).toThrow();
  });
});

describe("parsing and formatting", () => {
  it("parses decimal strings without float error", () => {
    expect(fromMajor("0.1", "NGN").amountMinor).toBe(10n);
    expect(fromMajor("1,250,000.55", "NGN").amountMinor).toBe(125_000_055n);
    expect(fromMajor("-3", "USD").amountMinor).toBe(-300n);
  });

  it("rejects too many decimals instead of rounding silently", () => {
    expect(() => fromMajor("1.005", "USD")).toThrow(RangeError);
    expect(() => fromMajor("1.5", "JPY")).toThrow(RangeError);
    expect(() => fromMajor("abc", "USD")).toThrow(RangeError);
  });

  it("round-trips through the major string", () => {
    expect(toMajorString(ngn(125_050n))).toBe("1250.50");
    expect(toMajorString(ngn(-5n))).toBe("-0.05");
    expect(toMajorString(money(1200n, "JPY"))).toBe("1200");
  });

  it("formats for display", () => {
    expect(formatMoney(ngn(165_000_000n))).toMatch(/1,650,000/);
    expect(formatMoney(money(1999n, "USD"), { locale: "en-US" })).toBe("$19.99");
    expect(formatMoney(money(2000n, "USD"), { locale: "en-US" })).toBe("$20");
  });

  it("serialises to JSON-safe strings and back", () => {
    const m = ngn(9_007_199_254_740_993n); // > Number.MAX_SAFE_INTEGER
    expect(fromJSON(toJSON(m))).toEqual(m);
    expect(() => fromJSON({ amountMinor: "1.5", currency: "NGN" })).toThrow();
    expect(() => fromJSON({ amountMinor: "1", currency: "XXX" as never })).toThrow();
  });
});

describe("convert", () => {
  it("converts using a decimal rate string", () => {
    // ₦1,650,000.00 at 0.00065 USD per NGN = $1,072.50
    expect(convert(ngn(165_000_000n), "0.00065", "USD")).toEqual(money(107_250n, "USD"));
  });

  it("accounts for different currency exponents", () => {
    // $10.00 at 150 JPY per USD = ¥1500
    expect(convert(money(1_000n, "USD"), "150", "JPY")).toEqual(money(1_500n, "JPY"));
    // ¥1500 at 0.0067 USD per JPY = $10.05
    expect(convert(money(1_500n, "JPY"), "0.0067", "USD")).toEqual(money(1_005n, "USD"));
  });

  it("rejects malformed rates", () => {
    expect(() => convert(ngn(1n), "1e-3", "USD")).toThrow(RangeError);
    expect(() => convert(ngn(1n), "-1", "USD")).toThrow(RangeError);
  });
});
