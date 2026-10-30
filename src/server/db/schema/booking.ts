import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, minor, timestamps, tstz } from "./_shared";
import { packageDepartures, packageOptions, packages, policies, travellerType } from "./catalogue";
import { messageVisibility } from "./crm";
import { users } from "./identity";

/*
 * Quoting & Booking (data-model §4–5, state-machines §1–2).
 *
 * Invariants enforced here:
 * - a quote is immutable once accepted; a booking points at exactly one accepted quote
 * - paid/refunded amounts are non-negative and refunded never exceeds paid
 * - booking_status_history is append-only (trigger in migration)
 * - seat holds are counted on package_departures.seats_held, whose CHECK prevents overselling
 */

export const quoteStatus = pgEnum("quote_status", ["active", "accepted", "expired", "superseded"]);
export const quoteLineKind = pgEnum("quote_line_kind", ["base", "room", "addon", "fee", "tax", "discount"]);
export const priceSourceKind = pgEnum("price_source", ["price_rule", "supplier", "manual"]);

export const bookingType = pgEnum("booking_type", ["package", "flight", "hotel", "custom", "service"]);
export const bookingStatus = pgEnum("booking_status", [
  "draft",
  "request_submitted",
  "awaiting_supplier",
  "awaiting_payment",
  "partially_paid",
  "confirmed",
  "ticketed",
  "in_progress",
  "completed",
  "cancellation_requested",
  "cancelled",
  "refund_pending",
  "refunded",
  "failed",
  "expired",
]);
export const actorType = pgEnum("actor_type", ["customer", "staff", "system", "provider"]);
export const bookingItemKind = pgEnum("booking_item_kind", [
  "package",
  "room",
  "addon",
  "flight",
  "hotel",
  "transfer",
  "insurance",
  "service",
  "fee",
]);
export const confirmationStatus = pgEnum("confirmation_status", ["requested", "held", "confirmed", "cancelled"]);
export const holdStatus = pgEnum("hold_status", ["held", "released", "converted"]);
export const cancellationRequestStatus = pgEnum("cancellation_request_status", [
  "submitted",
  "approved",
  "rejected",
  "withdrawn",
]);

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    reference: text("reference").notNull(),
    customerUserId: uuid("customer_user_id").references(() => users.id, { onDelete: "set null" }),
    productType: bookingType("product_type").notNull(),
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "restrict" }),
    departureId: uuid("departure_id").references(() => packageDepartures.id, { onDelete: "restrict" }),
    /** The validated selection the quote was priced from (rooms, travellers, add-ons). */
    input: jsonb("input").notNull(),
    currency: currency().notNull(),
    subtotalMinor: minor("subtotal_minor").notNull(),
    feesMinor: minor("fees_minor")
      .notNull()
      .default(sql`0`),
    taxMinor: minor("tax_minor")
      .notNull()
      .default(sql`0`),
    totalMinor: minor("total_minor").notNull(),
    depositMinor: minor("deposit_minor").notNull(),
    balanceDueDate: date("balance_due_date"),
    pricingVersion: smallint("pricing_version").notNull().default(1),
    status: quoteStatus("status").notNull().default("active"),
    expiresAt: tstz("expires_at").notNull(),
    acceptedAt: tstz("accepted_at"),
    cancellationPolicyId: uuid("cancellation_policy_id").references(() => policies.id),
    termsPolicyId: uuid("terms_policy_id").references(() => policies.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("quotes_reference_uq").on(t.reference),
    index("quotes_status_expiry_idx").on(t.status, t.expiresAt),
    check(
      "quotes_totals",
      sql`${t.totalMinor} = ${t.subtotalMinor} + ${t.feesMinor} + ${t.taxMinor} AND ${t.totalMinor} >= 0`,
    ),
    check("quotes_deposit", sql`${t.depositMinor} >= 0 AND ${t.depositMinor} <= ${t.totalMinor}`),
    check("quotes_accepted", sql`(${t.status} = 'accepted') = (${t.acceptedAt} IS NOT NULL)`),
  ],
);

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: id(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    kind: quoteLineKind("kind").notNull(),
    description: text("description").notNull(),
    optionId: uuid("option_id").references(() => packageOptions.id, { onDelete: "set null" }),
    travellerType: travellerType("traveller_type"),
    quantity: integer("quantity").notNull(),
    unitMinor: minor("unit_minor").notNull(),
    totalMinor: minor("total_minor").notNull(),
    source: priceSourceKind("source").notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("quote_lines_quote_idx").on(t.quoteId, t.position), check("quote_lines_qty", sql`${t.quantity} > 0`)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    reference: text("reference").notNull(),
    type: bookingType("type").notNull(),
    status: bookingStatus("status").notNull(),
    customerUserId: uuid("customer_user_id").references(() => users.id, { onDelete: "set null" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "restrict" }),
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "restrict" }),
    departureId: uuid("departure_id").references(() => packageDepartures.id, { onDelete: "restrict" }),
    currency: currency().notNull(),
    totalMinor: minor("total_minor").notNull(),
    depositMinor: minor("deposit_minor").notNull(),
    /** Cached from the ledger inside the same transaction; the ledger is the source of truth. */
    paidMinor: minor("paid_minor")
      .notNull()
      .default(sql`0`),
    refundedMinor: minor("refunded_minor")
      .notNull()
      .default(sql`0`),
    balanceMinor: bigint("balance_minor", { mode: "bigint" }).generatedAlwaysAs(
      sql`total_minor - paid_minor + refunded_minor`,
    ),
    adults: smallint("adults").notNull(),
    children: smallint("children").notNull().default(0),
    travelStart: date("travel_start"),
    travelEnd: date("travel_end"),
    balanceDueDate: date("balance_due_date"),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id, { onDelete: "set null" }),
    source: text("source").notNull().default("web"),
    idempotencyKey: text("idempotency_key").notNull(),
    cancellationPolicyId: uuid("cancellation_policy_id").references(() => policies.id),
    termsPolicyId: uuid("terms_policy_id").references(() => policies.id),
    /** Unpaid instant bookings and unanswered requests lapse at this time. */
    expiresAt: tstz("expires_at"),
    customerNotes: text("customer_notes"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("bookings_reference_uq").on(t.reference),
    uniqueIndex("bookings_idempotency_uq").on(t.idempotencyKey),
    uniqueIndex("bookings_quote_uq").on(t.quoteId),
    index("bookings_customer_idx").on(t.customerUserId, t.createdAt),
    index("bookings_status_idx").on(t.status),
    index("bookings_assigned_idx").on(t.assignedStaffId, t.status),
    index("bookings_travel_start_idx").on(t.travelStart),
    index("bookings_expires_idx").on(t.expiresAt),
    check(
      "bookings_amounts",
      sql`${t.totalMinor} >= 0 AND ${t.paidMinor} >= 0 AND ${t.refundedMinor} >= 0 AND ${t.refundedMinor} <= ${t.paidMinor}`,
    ),
    check("bookings_deposit", sql`${t.depositMinor} >= 0 AND ${t.depositMinor} <= ${t.totalMinor}`),
    check("bookings_travellers", sql`${t.adults} >= 1 AND ${t.children} >= 0`),
  ],
);

export const bookingTravellers = pgTable(
  "booking_travellers",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    travellerType: travellerType("traveller_type").notNull(),
    title: text("title"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** AES-256-GCM envelopes (server/lib/crypto). Never logged, never sent to AI providers. */
    dateOfBirthEnc: text("date_of_birth_enc"),
    passportNumberEnc: text("passport_number_enc"),
    passportLast4: text("passport_last4"),
    passportExpiry: date("passport_expiry"),
    nationality: text("nationality"),
    isLead: smallint("is_lead").notNull().default(0),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("booking_travellers_booking_idx").on(t.bookingId, t.position),
    uniqueIndex("booking_travellers_one_lead")
      .on(t.bookingId)
      .where(sql`${t.isLead} = 1`),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: bookingItemKind("kind").notNull(),
    description: text("description").notNull(),
    optionId: uuid("option_id").references(() => packageOptions.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    unitMinor: minor("unit_minor").notNull(),
    totalMinor: minor("total_minor").notNull(),
    confirmationStatus: confirmationStatus("confirmation_status").notNull().default("requested"),
    supplierReference: text("supplier_reference"),
    ...timestamps(),
  },
  (t) => [index("booking_items_booking_idx").on(t.bookingId)],
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    fromStatus: bookingStatus("from_status"),
    toStatus: bookingStatus("to_status").notNull(),
    actorType: actorType("actor_type").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("booking_status_history_booking_idx").on(t.bookingId, t.createdAt)],
);

export const inventoryHolds = pgTable(
  "inventory_holds",
  {
    id: id(),
    departureId: uuid("departure_id")
      .notNull()
      .references(() => packageDepartures.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    seats: smallint("seats").notNull(),
    status: holdStatus("status").notNull().default("held"),
    expiresAt: tstz("expires_at").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("inventory_holds_expiry_idx").on(t.status, t.expiresAt),
    uniqueIndex("inventory_holds_one_active")
      .on(t.bookingId)
      .where(sql`${t.status} = 'held'`),
    check("inventory_holds_seats", sql`${t.seats} > 0`),
  ],
);

export const cancellationRequests = pgTable(
  "cancellation_requests",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by").references(() => users.id),
    requestedByType: actorType("requested_by_type").notNull(),
    previousStatus: bookingStatus("previous_status").notNull(),
    reason: text("reason").notNull(),
    status: cancellationRequestStatus("status").notNull().default("submitted"),
    currency: currency().notNull(),
    penaltyMinor: minor("penalty_minor").notNull(),
    refundableMinor: minor("refundable_minor").notNull(),
    /** The policy rules and inputs used, frozen at request time. */
    calculation: jsonb("calculation").notNull(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: tstz("decided_at"),
    decisionNote: text("decision_note"),
    ...timestamps(),
  },
  (t) => [
    index("cancellation_requests_booking_idx").on(t.bookingId),
    uniqueIndex("cancellation_requests_one_open")
      .on(t.bookingId)
      .where(sql`${t.status} = 'submitted'`),
    check("cancellation_requests_amounts", sql`${t.penaltyMinor} >= 0 AND ${t.refundableMinor} >= 0`),
  ],
);

export const bookingNotes = pgTable(
  "booking_notes",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id),
    visibility: messageVisibility("visibility").notNull().default("internal"),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("booking_notes_booking_idx").on(t.bookingId, t.createdAt)],
);

/** One-time codes for guest booking lookup (journeys J04). Only a hash is stored. */
export const guestAccessCodes = pgTable(
  "guest_access_codes",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: tstz("expires_at").notNull(),
    consumedAt: tstz("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("guest_access_codes_booking_idx").on(t.bookingId, t.createdAt)],
);
