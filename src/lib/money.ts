/**
 * Money primitives. Amounts are integer minor units (kobo, cents) held as `bigint`.
 * Floats are never used for money (ARCHITECTURE.md §6, RULES.md §3).
 *
 * Rounding: every operation that can produce a fraction of a minor unit takes an explicit
 * rounding mode. The default is banker's rounding (half-even), which avoids systematic
 * upward drift when many amounts are rounded.
 *
 * Pure module: safe for server and client.
 */

export const CURRENCIES = {
  NGN: { exponent: 2, symbol: "₦", name: "Nigerian naira" },
  USD: { exponent: 2, symbol: "$", name: "US dollar" },
  GBP: { exponent: 2, symbol: "£", name: "British pound" },
  EUR: { exponent: 2, symbol: "€", name: "Euro" },
  GHS: { exponent: 2, symbol: "GH₵", name: "Ghanaian cedi" },
  KES: { exponent: 2, symbol: "KSh", name: "Kenyan shilling" },
  ZAR: { exponent: 2, symbol: "R", name: "South African rand" },
  AED: { exponent: 2, symbol: "AED", name: "UAE dirham" },
  JPY: { exponent: 0, symbol: "¥", name: "Japanese yen" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export type RoundingMode = "half-even" | "half-up" | "down" | "up";

export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function exponentOf(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}

export function money(amountMinor: bigint | number, currency: CurrencyCode): Money {
  if (typeof amountMinor === "number") {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new RangeError(`Minor amount must be a safe integer, got ${amountMinor}`);
    }
    amountMinor = BigInt(amountMinor);
  }
  return Object.freeze({ amountMinor, currency });
}

export const zero = (currency: CurrencyCode): Money => money(0n, currency);

function assertSame(a: Money, b: Money) {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSame(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, m) => add(acc, m), zero(currency));
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSame(a, b);
  return a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0;
}

export const isZero = (m: Money) => m.amountMinor === 0n;
export const isNegative = (m: Money) => m.amountMinor < 0n;

/** Divide two bigints and round the quotient with the given mode. */
export function divRound(numerator: bigint, denominator: bigint, mode: RoundingMode = "half-even"): bigint {
  if (denominator === 0n) throw new RangeError("Division by zero");
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const negative = numerator < 0n;
  const absN = negative ? -numerator : numerator;
  let q = absN / denominator;
  const r = absN % denominator;
  if (r !== 0n) {
    const twice = r * 2n;
    switch (mode) {
      case "down":
        // Toward zero on the absolute value, i.e. truncate.
        break;
      case "up":
        q += 1n;
        break;
      case "half-up":
        if (twice >= denominator) q += 1n;
        break;
      case "half-even":
        if (twice > denominator || (twice === denominator && q % 2n === 1n)) q += 1n;
        break;
    }
  }
  return negative ? -q : q;
}

/** Multiply by an integer quantity (e.g. travellers × unit price). Exact. */
export function multiply(m: Money, quantity: number | bigint): Money {
  const q = typeof quantity === "number" ? BigInt(quantity) : quantity;
  if (typeof quantity === "number" && !Number.isInteger(quantity)) {
    throw new RangeError("Quantity must be an integer; use multiplyRatio for fractions");
  }
  return money(m.amountMinor * q, m.currency);
}

/** Multiply by numerator/denominator with explicit rounding. */
export function multiplyRatio(
  m: Money,
  numerator: bigint | number,
  denominator: bigint | number,
  mode: RoundingMode = "half-even",
): Money {
  return money(divRound(m.amountMinor * BigInt(numerator), BigInt(denominator), mode), m.currency);
}

/** Percentage expressed in basis points (1% = 100 bp, 7.5% = 750 bp). */
export function percentOf(m: Money, basisPoints: number, mode: RoundingMode = "half-even"): Money {
  if (!Number.isInteger(basisPoints)) throw new RangeError("Basis points must be an integer");
  return multiplyRatio(m, basisPoints, 10_000, mode);
}

/**
 * Split an amount by integer weights without losing or inventing minor units.
 * Leftover units (from rounding down) go to the shares with the largest remainders,
 * ties broken by position. The result always sums exactly to the input.
 */
export function allocate(m: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) throw new RangeError("At least one weight is required");
  if (weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new RangeError("Weights must be non-negative integers");
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) throw new RangeError("Weights must not all be zero");

  const sign = m.amountMinor < 0n ? -1n : 1n;
  const abs = m.amountMinor * sign;
  const bigTotal = BigInt(total);
  const base = weights.map((w) => (abs * BigInt(w)) / bigTotal);
  const remainders = weights.map((w, i) => ({ i, r: (abs * BigInt(w)) % bigTotal }));
  let leftover = abs - base.reduce((a, b) => a + b, 0n);

  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of remainders) {
    if (leftover === 0n) break;
    if (weights[i] === 0) continue;
    base[i] += 1n;
    leftover -= 1n;
  }
  return base.map((v) => money(v * sign, m.currency));
}

/**
 * Parse a decimal string in major units ("1250.50") into Money. Rejects more decimal places
 * than the currency supports instead of silently rounding.
 */
export function fromMajor(value: string, currency: CurrencyCode): Money {
  const trimmed = value.trim().replace(/,/g, "");
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) throw new RangeError(`Invalid amount: "${value}"`);
  const [, neg, whole, frac = ""] = match;
  const exp = exponentOf(currency);
  if (frac.length > exp) {
    throw new RangeError(`${currency} supports at most ${exp} decimal places`);
  }
  const minor = BigInt(whole) * 10n ** BigInt(exp) + BigInt(frac.padEnd(exp, "0") || "0");
  return money(neg ? -minor : minor, currency);
}

/** Exact major-unit decimal string, e.g. 125050n NGN → "1250.50". */
export function toMajorString(m: Money): string {
  const exp = exponentOf(m.currency);
  const negative = m.amountMinor < 0n;
  const abs = negative ? -m.amountMinor : m.amountMinor;
  if (exp === 0) return `${negative ? "-" : ""}${abs}`;
  const factor = 10n ** BigInt(exp);
  const whole = abs / factor;
  const frac = (abs % factor).toString().padStart(exp, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/**
 * Convert using a decimal rate string ("0.000652" = 1 unit of `from` in `to`).
 * Rates are strings so no float precision is lost. Result is indicative unless the
 * payment provider quoted the rate (RULES.md §1, PRD multi-currency rules).
 */
export function convert(m: Money, rate: string, to: CurrencyCode, mode: RoundingMode = "half-even"): Money {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  if (!match) throw new RangeError(`Invalid rate: "${rate}"`);
  const [, whole, frac = ""] = match;
  const rateNumerator = BigInt(whole + frac);
  const rateDenominator = 10n ** BigInt(frac.length);
  const expDiff = exponentOf(to) - exponentOf(m.currency);
  const scaleNum = expDiff >= 0 ? 10n ** BigInt(expDiff) : 1n;
  const scaleDen = expDiff < 0 ? 10n ** BigInt(-expDiff) : 1n;
  return money(divRound(m.amountMinor * rateNumerator * scaleNum, rateDenominator * scaleDen, mode), to);
}

export interface FormatOptions {
  locale?: string;
  /** Hide minor units when they are zero (₦250,000 instead of ₦250,000.00). */
  compactZeroMinor?: boolean;
}

/** Locale display string. Formatting goes through the exact decimal string, never a float sum. */
export function formatMoney(m: Money, { locale = "en-NG", compactZeroMinor = true }: FormatOptions = {}): string {
  const exp = exponentOf(m.currency);
  const showMinor = !(compactZeroMinor && m.amountMinor % 10n ** BigInt(exp) === 0n);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: showMinor ? exp : 0,
    maximumFractionDigits: showMinor ? exp : 0,
  });
  // Intl accepts decimal strings in modern runtimes, which keeps large values exact.
  return formatter.format(toMajorString(m) as unknown as number);
}

/** JSON-safe representation for transport (bigint is not JSON serialisable). */
export interface MoneyJSON {
  amountMinor: string;
  currency: CurrencyCode;
}

export const toJSON = (m: Money): MoneyJSON => ({ amountMinor: m.amountMinor.toString(), currency: m.currency });

export function fromJSON(j: MoneyJSON): Money {
  if (!/^-?\d+$/.test(j.amountMinor)) throw new RangeError("Invalid minor amount");
  if (!isCurrencyCode(j.currency)) throw new RangeError(`Unsupported currency ${j.currency}`);
  return money(BigInt(j.amountMinor), j.currency);
}
