import { type CurrencyCode, isCurrencyCode, money, percentOf } from "@/lib/money";
import { type DepartureInput, type PriceRuleInput, isBookableDeparture, resolveRule } from "./from-price";

/**
 * Package quote engine. Pure: the caller loads the package data and passes it in, so every
 * rule here is unit-tested and the browser never computes a price (RULES.md §1.2).
 *
 * Pricing rules
 * - Rooms are priced per person from the room option's rule for each traveller type. A child
 *   with no child rule makes the quote fail ("price on request") rather than silently charging
 *   the adult rate.
 * - A room holds at most its occupancy in adults, plus one sharing child; at least one adult.
 * - Per-person add-ons are charged for the number of travellers who take them.
 * - Percentage fees apply to the room + add-on subtotal; fixed fees apply once per booking.
 *   Fees flagged `isTax` are reported as tax.
 * - Deposit = plan percentage of the total (at least the plan minimum), or the full total when
 *   the departure is inside the balance-due window.
 */

export interface QuoteOption {
  id: string;
  kind: "room" | "addon";
  name: string;
  pricingBasis: "per_person" | "per_room" | "per_booking";
  occupancy: number | null;
}

export interface QuoteFee {
  code: string;
  name: string;
  kind: "fixed" | "percent";
  amountMinor: bigint | null;
  currency: string | null;
  basisPoints: number | null;
  isTax: boolean;
  isMandatory: boolean;
  isActive: boolean;
}

export interface QuotePlan {
  depositBasisPoints: number;
  depositMinMinor: bigint | null;
  balanceDueDaysBefore: number;
}

export interface QuoteSelection {
  departureId: string;
  rooms: { optionId: string; adults: number; children: number }[];
  addons: { optionId: string; travellers: number }[];
}

export interface QuoteContext {
  package: { minPax: number; maxPax: number };
  options: readonly QuoteOption[];
  rules: readonly PriceRuleInput[];
  fees: readonly QuoteFee[];
  plan: QuotePlan | null;
  departure: DepartureInput & { endDate: string };
  today: string;
}

export interface QuoteLine {
  kind: "room" | "addon" | "fee" | "tax";
  description: string;
  optionId: string | null;
  travellerType: "adult" | "child" | null;
  quantity: number;
  unitMinor: bigint;
  totalMinor: bigint;
}

export interface QuoteResult {
  currency: CurrencyCode;
  lines: QuoteLine[];
  subtotalMinor: bigint;
  feesMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  depositMinor: bigint;
  balanceDueDate: string | null;
  adults: number;
  children: number;
}

export class QuoteError extends Error {
  constructor(
    readonly code:
      | "DEPARTURE_UNAVAILABLE"
      | "NOT_ENOUGH_SEATS"
      | "PAX_OUT_OF_RANGE"
      | "INVALID_ROOM"
      | "INVALID_ADDON"
      | "PRICE_ON_REQUEST"
      | "CURRENCY_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeQuote(ctx: QuoteContext, sel: QuoteSelection): QuoteResult {
  const dep = ctx.departure;
  if (dep.id !== sel.departureId || !isBookableDeparture(dep, ctx.today)) {
    throw new QuoteError("DEPARTURE_UNAVAILABLE", "That departure is no longer available.");
  }

  const option = (id: string) => ctx.options.find((o) => o.id === id);
  let adults = 0;
  let children = 0;
  let currency: CurrencyCode | null = null;
  const lines: QuoteLine[] = [];

  const price = (optionId: string, traveller: "adult" | "child", label: string) => {
    const rule = resolveRule(ctx.rules, dep, optionId, traveller);
    if (!rule || !isCurrencyCode(rule.currency)) {
      throw new QuoteError(
        "PRICE_ON_REQUEST",
        `${label} isn't priced online for this departure. Please enquire and we'll quote it.`,
      );
    }
    if (currency && rule.currency !== currency) {
      throw new QuoteError("CURRENCY_MISMATCH", "This package has prices in more than one currency. Please enquire.");
    }
    currency = rule.currency;
    return rule.amountMinor;
  };

  if (sel.rooms.length === 0) throw new QuoteError("INVALID_ROOM", "Choose at least one room.");
  for (const r of sel.rooms) {
    const opt = option(r.optionId);
    if (!opt || opt.kind !== "room" || opt.pricingBasis !== "per_person" || !opt.occupancy) {
      throw new QuoteError("INVALID_ROOM", "That room type isn't available for this package.");
    }
    if (!Number.isInteger(r.adults) || !Number.isInteger(r.children) || r.adults < 1 || r.children < 0) {
      throw new QuoteError("INVALID_ROOM", "Each room needs at least one adult.");
    }
    if (r.adults > opt.occupancy || r.children > 1 || r.adults + r.children > opt.occupancy + 1) {
      throw new QuoteError(
        "INVALID_ROOM",
        `A ${opt.name.toLowerCase()} sleeps ${opt.occupancy} adult(s) plus at most one child.`,
      );
    }
    adults += r.adults;
    children += r.children;
  }

  // Group identical room/traveller combinations into single lines for a readable breakdown.
  const grouped = new Map<string, { optionId: string; traveller: "adult" | "child"; count: number }>();
  for (const r of sel.rooms) {
    for (const [traveller, count] of [
      ["adult", r.adults],
      ["child", r.children],
    ] as const) {
      if (count === 0) continue;
      const key = `${r.optionId}:${traveller}`;
      const g = grouped.get(key) ?? { optionId: r.optionId, traveller, count: 0 };
      g.count += count;
      grouped.set(key, g);
    }
  }
  for (const g of grouped.values()) {
    const opt = option(g.optionId)!;
    const unit = price(g.optionId, g.traveller, `${opt.name} (${g.traveller})`);
    lines.push({
      kind: "room",
      description: `${opt.name}, ${g.traveller === "adult" ? "adult" : "child"}`,
      optionId: g.optionId,
      travellerType: g.traveller,
      quantity: g.count,
      unitMinor: unit,
      totalMinor: unit * BigInt(g.count),
    });
  }

  const pax = adults + children;
  if (pax < ctx.package.minPax || pax > ctx.package.maxPax) {
    throw new QuoteError(
      "PAX_OUT_OF_RANGE",
      `This package takes ${ctx.package.minPax}–${ctx.package.maxPax} travellers.`,
    );
  }
  const remaining = dep.capacity - dep.seatsHeld - dep.seatsConfirmed;
  if (pax > remaining) {
    throw new QuoteError(
      "NOT_ENOUGH_SEATS",
      remaining > 0 ? `Only ${remaining} place(s) are left on this departure.` : "This departure is full.",
    );
  }

  const seenAddons = new Set<string>();
  for (const a of sel.addons) {
    if (a.travellers === 0) continue;
    const opt = option(a.optionId);
    if (!opt || opt.kind !== "addon" || opt.pricingBasis !== "per_person" || seenAddons.has(a.optionId)) {
      throw new QuoteError("INVALID_ADDON", "That extra isn't available for this package.");
    }
    if (!Number.isInteger(a.travellers) || a.travellers < 0 || a.travellers > pax) {
      throw new QuoteError("INVALID_ADDON", "Add-ons can't be booked for more people than are travelling.");
    }
    seenAddons.add(a.optionId);
    const unit = price(a.optionId, "adult", opt.name);
    lines.push({
      kind: "addon",
      description: opt.name,
      optionId: opt.id,
      travellerType: null,
      quantity: a.travellers,
      unitMinor: unit,
      totalMinor: unit * BigInt(a.travellers),
    });
  }

  const cur = currency as CurrencyCode | null;
  if (!cur) throw new QuoteError("PRICE_ON_REQUEST", "This package isn't priced online. Please enquire.");
  const subtotal = lines.reduce((s, l) => s + l.totalMinor, 0n);

  let feesMinor = 0n;
  let taxMinor = 0n;
  for (const f of ctx.fees) {
    if (!f.isActive || !f.isMandatory) continue;
    let amount: bigint;
    if (f.kind === "percent") {
      amount = percentOf(money(subtotal, cur), f.basisPoints ?? 0).amountMinor;
    } else {
      if (f.currency?.trim() !== cur)
        throw new QuoteError("CURRENCY_MISMATCH", `Fee ${f.name} is in a different currency.`);
      amount = f.amountMinor ?? 0n;
    }
    if (amount === 0n) continue;
    lines.push({
      kind: f.isTax ? "tax" : "fee",
      description: f.name,
      optionId: null,
      travellerType: null,
      quantity: 1,
      unitMinor: amount,
      totalMinor: amount,
    });
    if (f.isTax) taxMinor += amount;
    else feesMinor += amount;
  }

  const total = subtotal + feesMinor + taxMinor;
  let deposit = total;
  let balanceDueDate: string | null = null;
  if (ctx.plan) {
    balanceDueDate = addDaysIso(dep.startDate, -ctx.plan.balanceDueDaysBefore);
    if (balanceDueDate > ctx.today) {
      deposit = percentOf(money(total, cur), ctx.plan.depositBasisPoints, "up").amountMinor;
      if (ctx.plan.depositMinMinor !== null && deposit < ctx.plan.depositMinMinor) deposit = ctx.plan.depositMinMinor;
      if (deposit > total) deposit = total;
    } else {
      // Inside the balance window: full payment now.
      balanceDueDate = null;
    }
  }

  return {
    currency: cur,
    lines,
    subtotalMinor: subtotal,
    feesMinor,
    taxMinor,
    totalMinor: total,
    depositMinor: deposit,
    balanceDueDate,
    adults,
    children,
  };
}
