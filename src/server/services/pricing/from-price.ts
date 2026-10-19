import { type CurrencyCode, type Money, isCurrencyCode, money } from "@/lib/money";

/**
 * "From" price for listings: the lowest adult, per-person price of any room option on any
 * bookable upcoming departure, using the same rule precedence the quote engine will use
 * (Phase 4). Pure, so it is unit-tested directly.
 *
 * Precedence for a (departure, option) pair:
 *   1. rule must be valid on the departure's start date (validFrom/validTo inclusive)
 *   2. a departure-specific rule beats an all-departures rule
 *   3. higher `priority` wins; ties go to the lower amount (never surprise the customer upward)
 */

export interface PriceRuleInput {
  departureId: string | null;
  optionId: string | null;
  travellerType: "adult" | "child" | "infant";
  amountMinor: bigint;
  currency: string;
  validFrom: string | null;
  validTo: string | null;
  priority: number;
}

export interface OptionInput {
  id: string;
  kind: "room" | "addon";
  pricingBasis: "per_person" | "per_room" | "per_booking";
}

export interface DepartureInput {
  id: string;
  startDate: string; // YYYY-MM-DD
  status: "open" | "limited" | "closed" | "cancelled";
  bookingDeadline: string | null;
  capacity: number;
  seatsHeld: number;
  seatsConfirmed: number;
}

export function isBookableDeparture(d: DepartureInput, today: string): boolean {
  if (d.status !== "open" && d.status !== "limited") return false;
  if (d.startDate <= today) return false;
  if (d.bookingDeadline && d.bookingDeadline < today) return false;
  return d.capacity - d.seatsHeld - d.seatsConfirmed > 0;
}

export function resolveRule(
  rules: readonly PriceRuleInput[],
  departure: Pick<DepartureInput, "id" | "startDate">,
  optionId: string | null,
  travellerType: PriceRuleInput["travellerType"],
): PriceRuleInput | null {
  const candidates = rules.filter(
    (r) =>
      r.optionId === optionId &&
      r.travellerType === travellerType &&
      (r.departureId === null || r.departureId === departure.id) &&
      (r.validFrom === null || r.validFrom <= departure.startDate) &&
      (r.validTo === null || r.validTo >= departure.startDate),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const spec = Number(b.departureId !== null) - Number(a.departureId !== null);
    if (spec !== 0) return spec;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0;
  });
  return candidates[0];
}

export function computeFromPrice(input: {
  rules: readonly PriceRuleInput[];
  options: readonly OptionInput[];
  departures: readonly DepartureInput[];
  today: string;
}): Money | null {
  const rooms = input.options.filter((o) => o.kind === "room" && o.pricingBasis === "per_person");
  const bookable = input.departures.filter((d) => isBookableDeparture(d, input.today));
  let best: { amount: bigint; currency: CurrencyCode } | null = null;

  for (const dep of bookable) {
    for (const room of rooms) {
      const rule = resolveRule(input.rules, dep, room.id, "adult");
      if (!rule || !isCurrencyCode(rule.currency)) continue;
      // Mixed currencies can't be compared without FX; the first currency found wins and
      // others are ignored. Packages are priced in one currency in practice.
      if (best && best.currency !== rule.currency) continue;
      if (!best || rule.amountMinor < best.amount) best = { amount: rule.amountMinor, currency: rule.currency };
    }
  }
  return best ? money(best.amount, best.currency) : null;
}
