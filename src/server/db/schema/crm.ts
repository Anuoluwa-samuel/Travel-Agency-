import { sql } from "drizzle-orm";
import { check, date, index, jsonb, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, currency, id, minor, timestamps, tstz } from "./_shared";
import { destinations, packages } from "./catalogue";
import { users } from "./identity";

/*
 * CRM (data-model §7): enquiries and their message thread. An enquiry is a request for help,
 * never a reservation (PRD §5).
 */

export const enquiryCategory = pgEnum("enquiry_category", [
  "package",
  "custom_trip",
  "flight",
  "hotel",
  "visa",
  "group",
  "corporate",
  "other",
]);

export const enquiryStatus = pgEnum("enquiry_status", [
  "new",
  "assigned",
  "in_progress",
  "awaiting_customer",
  "awaiting_supplier",
  "converted",
  "closed",
]);

export const enquiryPriority = pgEnum("enquiry_priority", ["low", "normal", "high", "urgent"]);
export const contactMethod = pgEnum("contact_method", ["email", "phone", "whatsapp"]);
export const messageAuthor = pgEnum("message_author", ["customer", "staff", "system"]);
export const messageChannel = pgEnum("message_channel", ["web", "email", "whatsapp", "phone", "internal"]);
export const messageVisibility = pgEnum("message_visibility", ["internal", "customer"]);

export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    reference: text("reference").notNull(),
    category: enquiryCategory("category").notNull(),
    status: enquiryStatus("status").notNull().default("new"),
    priority: enquiryPriority("priority").notNull().default("normal"),
    customerUserId: uuid("customer_user_id").references(() => users.id, { onDelete: "set null" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    preferredContact: contactMethod("preferred_contact").notNull().default("email"),
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
    destinationId: uuid("destination_id").references(() => destinations.id, { onDelete: "set null" }),
    /** Free-text destination when it isn't in our catalogue. */
    destinationText: text("destination_text"),
    departureCity: text("departure_city"),
    travelFrom: date("travel_from"),
    travelTo: date("travel_to"),
    flexibleDates: text("flexible_dates"),
    adults: smallint("adults").notNull().default(1),
    children: smallint("children").notNull().default(0),
    budgetMinor: minor("budget_minor"),
    budgetCurrency: currency("budget_currency"),
    message: text("message").notNull(),
    source: text("source").notNull().default("web"),
    /** Page the enquiry came from and UTM parameters, for conversion reporting. */
    attribution: jsonb("attribution"),
    marketingConsent: tstz("marketing_consent_at"),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id, { onDelete: "set null" }),
    followUpAt: tstz("follow_up_at"),
    convertedBookingId: uuid("converted_booking_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    acknowledgementSentAt: tstz("acknowledgement_sent_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("enquiries_reference_uq").on(t.reference),
    uniqueIndex("enquiries_idempotency_uq").on(t.idempotencyKey),
    index("enquiries_status_idx").on(t.status, t.assignedStaffId),
    index("enquiries_follow_up_idx").on(t.followUpAt),
    index("enquiries_customer_idx").on(t.customerUserId, t.createdAt),
    check(
      "enquiries_travellers",
      sql`${t.adults} BETWEEN 0 AND 99 AND ${t.children} BETWEEN 0 AND 99 AND ${t.adults} + ${t.children} >= 1`,
    ),
    check("enquiries_dates", sql`${t.travelFrom} IS NULL OR ${t.travelTo} IS NULL OR ${t.travelFrom} <= ${t.travelTo}`),
    check(
      "enquiries_budget",
      sql`${t.budgetMinor} IS NULL OR (${t.budgetMinor} > 0 AND ${t.budgetCurrency} IS NOT NULL)`,
    ),
    check("enquiries_converted", sql`${t.status} <> 'converted' OR ${t.convertedBookingId} IS NOT NULL`),
  ],
);

export const enquiryMessages = pgTable(
  "enquiry_messages",
  {
    id: id(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    authorType: messageAuthor("author_type").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    channel: messageChannel("channel").notNull(),
    visibility: messageVisibility("visibility").notNull().default("customer"),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("enquiry_messages_enquiry_idx").on(t.enquiryId, t.createdAt)],
);
