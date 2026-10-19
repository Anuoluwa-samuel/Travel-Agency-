import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, currency, id, minor, timestamps, tstz } from "./_shared";
import { bookings, cancellationRequests } from "./booking";
import { users } from "./identity";

/*
 * Payments & Finance (data-model §6, ARCHITECTURE §6–7).
 *
 * - `transactions` and `ledger_entries` are append-only (triggers in the migration).
 * - `transactions (provider, provider_reference, kind)` is unique, so a webhook delivered twice
 *   cannot create two charges, and `webhook_events (provider, event_id)` blocks replays.
 * - Ledger sign convention, from the customer's point of view: `charge_due` is positive (they
 *   owe more), `payment_received` is negative, `refund_issued` is positive. The sum per booking
 *   is the balance outstanding, and must equal bookings.balance_minor.
 */

export const invoiceStatus = pgEnum("invoice_status", ["draft", "issued", "partially_paid", "paid", "void"]);
export const scheduleStatus = pgEnum("schedule_status", ["pending", "paid", "overdue", "waived"]);
export const paymentProvider = pgEnum("payment_provider", ["paystack", "mock", "manual"]);
export const paymentAttemptStatus = pgEnum("payment_attempt_status", [
  "initialized",
  "pending",
  "succeeded",
  "failed",
  "abandoned",
]);
export const transactionKind = pgEnum("transaction_kind", ["charge", "refund", "reversal"]);
export const transactionStatus = pgEnum("transaction_status", ["succeeded", "failed"]);
export const verifiedVia = pgEnum("verified_via", ["webhook", "api_verify", "staff"]);
export const refundStatus = pgEnum("refund_status", ["requested", "approved", "processing", "completed", "failed"]);
export const ledgerEntryType = pgEnum("ledger_entry_type", [
  "charge_due",
  "payment_received",
  "refund_issued",
  "adjustment",
  "write_off",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    reference: text("reference").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    currency: currency().notNull(),
    totalMinor: minor("total_minor").notNull(),
    status: invoiceStatus("status").notNull().default("issued"),
    issuedAt: tstz("issued_at").notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("invoices_reference_uq").on(t.reference),
    uniqueIndex("invoices_one_open_per_booking")
      .on(t.bookingId)
      .where(sql`${t.status} <> 'void'`),
    check("invoices_total", sql`${t.totalMinor} >= 0`),
  ],
);

export const paymentScheduleItems = pgTable(
  "payment_schedule_items",
  {
    id: id(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amountMinor: minor("amount_minor").notNull(),
    dueAt: tstz("due_at").notNull(),
    status: scheduleStatus("status").notNull().default("pending"),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("payment_schedule_items_invoice_idx").on(t.invoiceId, t.position),
    check("payment_schedule_amount", sql`${t.amountMinor} > 0`),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: id(),
    /** Our reference, sent to the provider; also the provider's transaction reference. */
    reference: text("reference").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    provider: paymentProvider("provider").notNull(),
    amountMinor: minor("amount_minor").notNull(),
    currency: currency().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: paymentAttemptStatus("status").notNull().default("initialized"),
    checkoutUrl: text("checkout_url"),
    providerAccessCode: text("provider_access_code"),
    simulated: boolean("simulated").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("payment_attempts_reference_uq").on(t.reference),
    uniqueIndex("payment_attempts_idempotency_uq").on(t.idempotencyKey),
    index("payment_attempts_booking_idx").on(t.bookingId, t.createdAt),
    check("payment_attempts_amount", sql`${t.amountMinor} > 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    paymentAttemptId: uuid("payment_attempt_id").references(() => paymentAttempts.id),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    provider: paymentProvider("provider").notNull(),
    providerReference: text("provider_reference").notNull(),
    kind: transactionKind("kind").notNull(),
    status: transactionStatus("status").notNull(),
    amountMinor: minor("amount_minor").notNull(),
    currency: currency().notNull(),
    channel: text("channel"),
    paidAt: tstz("paid_at"),
    verifiedVia: verifiedVia("verified_via").notNull(),
    /** Provider payload with card and customer details stripped. */
    rawPayload: jsonb("raw_payload"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("transactions_provider_ref_uq").on(t.provider, t.providerReference, t.kind),
    index("transactions_booking_idx").on(t.bookingId, t.createdAt),
    check("transactions_amount", sql`${t.amountMinor} > 0`),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    reference: text("reference").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    cancellationRequestId: uuid("cancellation_request_id").references(() => cancellationRequests.id),
    amountMinor: minor("amount_minor").notNull(),
    currency: currency().notNull(),
    reason: text("reason").notNull(),
    status: refundStatus("status").notNull().default("requested"),
    requestedBy: uuid("requested_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    providerReference: text("provider_reference"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("refunds_reference_uq").on(t.reference),
    index("refunds_booking_idx").on(t.bookingId),
    check("refunds_amount", sql`${t.amountMinor} > 0`),
    // Four-eyes rule: whoever requests a refund cannot approve it.
    check(
      "refunds_four_eyes",
      sql`${t.approvedBy} IS NULL OR ${t.requestedBy} IS NULL OR ${t.approvedBy} <> ${t.requestedBy}`,
    ),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    refundId: uuid("refund_id").references(() => refunds.id),
    entryType: ledgerEntryType("entry_type").notNull(),
    amountMinor: minor("amount_minor").notNull(),
    currency: currency().notNull(),
    memo: text("memo").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_entries_booking_idx").on(t.bookingId, t.createdAt),
    // At most one ledger entry per transaction: a replayed webhook can't post twice.
    uniqueIndex("ledger_entries_one_per_transaction")
      .on(t.transactionId)
      .where(sql`${t.transactionId} IS NOT NULL`),
    check("ledger_entries_nonzero", sql`${t.amountMinor} <> 0`),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: paymentProvider("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: createdAt(),
    processedAt: tstz("processed_at"),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_uq").on(t.provider, t.eventId)],
);
