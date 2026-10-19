/**
 * Booking state machine (docs/state-machines.md §1). Pure data + checks; the service applies a
 * transition inside a transaction and writes booking_status_history.
 *
 * `actors` lists who may trigger each transition. Guards that need data (payments received,
 * items confirmed, dates) are evaluated by the service before calling `assertTransition`.
 */

export type BookingStatus =
  | "draft"
  | "request_submitted"
  | "awaiting_supplier"
  | "awaiting_payment"
  | "partially_paid"
  | "confirmed"
  | "ticketed"
  | "in_progress"
  | "completed"
  | "cancellation_requested"
  | "cancelled"
  | "refund_pending"
  | "refunded"
  | "failed"
  | "expired";

export type BookingType = "package" | "flight" | "hotel" | "custom" | "service";
export type Actor = "customer" | "staff" | "system" | "provider";

type Rule = { to: BookingStatus; actors: readonly Actor[]; types?: readonly BookingType[] };

const ALL: readonly BookingType[] = ["package", "flight", "hotel", "custom", "service"];

export const TRANSITIONS: Readonly<Record<BookingStatus, readonly Rule[]>> = {
  draft: [
    { to: "request_submitted", actors: ["customer", "system"], types: ["package", "hotel"] },
    { to: "awaiting_payment", actors: ["system"], types: ["package", "flight", "hotel"] },
  ],
  request_submitted: [
    { to: "awaiting_supplier", actors: ["staff"] },
    { to: "awaiting_payment", actors: ["staff"] },
    { to: "failed", actors: ["staff"] },
    { to: "expired", actors: ["system"] },
  ],
  awaiting_supplier: [
    { to: "awaiting_payment", actors: ["staff"] },
    { to: "failed", actors: ["staff"] },
  ],
  awaiting_payment: [
    { to: "partially_paid", actors: ["system", "provider", "staff"], types: ["package", "hotel", "custom"] },
    { to: "confirmed", actors: ["system", "provider", "staff"] },
    { to: "expired", actors: ["system"] },
    { to: "cancellation_requested", actors: ["customer", "staff"] },
    { to: "cancelled", actors: ["staff", "provider"] },
  ],
  partially_paid: [
    { to: "confirmed", actors: ["system", "provider", "staff"] },
    { to: "cancellation_requested", actors: ["customer", "staff"] },
    { to: "cancelled", actors: ["staff", "provider"] },
  ],
  confirmed: [
    { to: "ticketed", actors: ["staff", "provider"], types: ["flight", "package", "custom"] },
    { to: "in_progress", actors: ["system"], types: ["package", "flight", "hotel", "custom"] },
    { to: "completed", actors: ["system", "staff"], types: ["service"] },
    { to: "cancellation_requested", actors: ["customer", "staff"] },
    { to: "cancelled", actors: ["staff", "provider"] },
  ],
  ticketed: [
    { to: "in_progress", actors: ["system"] },
    { to: "cancellation_requested", actors: ["customer", "staff"] },
  ],
  in_progress: [{ to: "completed", actors: ["system", "staff"] }],
  completed: [],
  // Rejecting or withdrawing a request returns to the pre-request status (validated by the service).
  cancellation_requested: [
    { to: "cancelled", actors: ["staff"] },
    { to: "awaiting_payment", actors: ["staff", "customer"] },
    { to: "partially_paid", actors: ["staff", "customer"] },
    { to: "confirmed", actors: ["staff", "customer"] },
    { to: "ticketed", actors: ["staff", "customer"] },
  ],
  cancelled: [{ to: "refund_pending", actors: ["staff"] }],
  refund_pending: [{ to: "refunded", actors: ["provider", "staff", "system"] }],
  refunded: [],
  failed: [],
  expired: [],
};

export const TERMINAL: ReadonlySet<BookingStatus> = new Set(["completed", "refunded", "failed", "expired"]);

/** Statuses in which the customer may pay online. */
export const PAYABLE: ReadonlySet<BookingStatus> = new Set(["awaiting_payment", "partially_paid", "confirmed"]);

/** Statuses in which a customer may ask to cancel (and travel hasn't started). */
export const CANCELLABLE: ReadonlySet<BookingStatus> = new Set([
  "awaiting_payment",
  "partially_paid",
  "confirmed",
  "ticketed",
]);

export function canTransition(type: BookingType, from: BookingStatus, to: BookingStatus, actor: Actor): boolean {
  return TRANSITIONS[from].some((r) => r.to === to && r.actors.includes(actor) && (r.types ?? ALL).includes(type));
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: BookingStatus,
    readonly to: BookingStatus,
    readonly actor: Actor,
  ) {
    super(`Booking cannot move from ${from} to ${to} (${actor})`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(type: BookingType, from: BookingStatus, to: BookingStatus, actor: Actor) {
  if (!canTransition(type, from, to, actor)) throw new InvalidTransitionError(from, to, actor);
}

/**
 * Status after a verified payment. Paid in full, or deposit paid with every item confirmed →
 * confirmed. Anything less but non-zero → partially_paid. Service bookings can't be part-paid.
 */
export function statusAfterPayment(input: {
  type: BookingType;
  current: BookingStatus;
  paidMinor: bigint;
  depositMinor: bigint;
  totalMinor: bigint;
  allItemsConfirmed: boolean;
}): BookingStatus {
  const { paidMinor, depositMinor, totalMinor, allItemsConfirmed } = input;
  if (input.current === "confirmed" || input.current === "ticketed") return input.current;
  if (paidMinor >= totalMinor && allItemsConfirmed) return "confirmed";
  if (paidMinor >= depositMinor && allItemsConfirmed) return "confirmed";
  if (paidMinor > 0n && input.type !== "service" && input.type !== "flight") return "partially_paid";
  return input.current;
}

/** Customer-facing labels (state-machines.md §1). */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: "Draft",
  request_submitted: "Request received",
  awaiting_supplier: "Awaiting confirmation",
  awaiting_payment: "Payment required",
  partially_paid: "Deposit paid",
  confirmed: "Confirmed",
  ticketed: "Tickets issued",
  in_progress: "On trip",
  completed: "Completed",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
  failed: "Unsuccessful",
  expired: "Expired",
};

export type StatusTone = "confirmed" | "pending" | "proposed" | "danger" | "info";
export const STATUS_TONE: Record<BookingStatus, StatusTone> = {
  draft: "proposed",
  request_submitted: "pending",
  awaiting_supplier: "pending",
  awaiting_payment: "pending",
  partially_paid: "pending",
  confirmed: "confirmed",
  ticketed: "confirmed",
  in_progress: "confirmed",
  completed: "info",
  cancellation_requested: "pending",
  cancelled: "danger",
  refund_pending: "pending",
  refunded: "info",
  failed: "danger",
  expired: "danger",
};
