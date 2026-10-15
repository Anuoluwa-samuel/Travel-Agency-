import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, currency, id, minor, timestamps, tstz } from "./_shared";
import { enquiries } from "./crm";
import { users } from "./identity";

/*
 * Consultations (data-model §7). Internal scheduling until a calendar integration is connected.
 * Double booking is prevented by an exclusion constraint added in a custom migration:
 *   EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
 *   WHERE (status IN ('requested', 'confirmed', 'rescheduled'))
 */

export const consultationFormat = pgEnum("consultation_format", ["video", "phone", "in_person"]);
export const consultationStatus = pgEnum("consultation_status", [
  "requested",
  "confirmed",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
]);

export const consultationServices = pgTable(
  "consultation_services",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    durationMinutes: smallint("duration_minutes").notNull(),
    formats: consultationFormat("formats").array().notNull(),
    /** Null = free. Paid consultations are collected through the payments module (Phase 4). */
    priceMinor: minor("price_minor"),
    currency: currency(),
    isActive: boolean("is_active").notNull().default(true),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    check("consultation_services_duration", sql`${t.durationMinutes} BETWEEN 15 AND 240`),
    check("consultation_services_formats", sql`cardinality(${t.formats}) >= 1`),
    check(
      "consultation_services_price",
      sql`${t.priceMinor} IS NULL OR (${t.priceMinor} > 0 AND ${t.currency} IS NOT NULL)`,
    ),
  ],
);

/** Which staff can run which consultation type. */
export const consultationServiceStaff = pgTable(
  "consultation_service_staff",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => consultationServices.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.staffId] })],
);

/** Weekly working hours, in the staff member's own timezone. ISO weekday: 1 = Monday … 7 = Sunday. */
export const staffAvailability = pgTable(
  "staff_availability",
  {
    id: id(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    timezone: text("timezone").notNull().default("Africa/Lagos"),
  },
  (t) => [
    index("staff_availability_staff_idx").on(t.staffId, t.weekday),
    check("staff_availability_weekday", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("staff_availability_range", sql`${t.startTime} < ${t.endTime}`),
  ],
);

/** Time off (holidays, leave, training). Blocks any overlapping slot. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: id(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("availability_exceptions_staff_idx").on(t.staffId, t.startsAt),
    check("availability_exceptions_range", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const consultations = pgTable(
  "consultations",
  {
    id: id(),
    reference: text("reference").notNull(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => consultationServices.id, { onDelete: "restrict" }),
    customerUserId: uuid("customer_user_id").references(() => users.id, { onDelete: "set null" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    /** The visitor's timezone at booking time, for reminders and display. */
    customerTimezone: text("customer_timezone").notNull().default("Africa/Lagos"),
    format: consultationFormat("format").notNull(),
    status: consultationStatus("status").notNull().default("confirmed"),
    notes: text("notes"),
    meetingLink: text("meeting_link"),
    enquiryId: uuid("enquiry_id").references(() => enquiries.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    confirmationSentAt: tstz("confirmation_sent_at"),
    cancelledAt: tstz("cancelled_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("consultations_reference_uq").on(t.reference),
    uniqueIndex("consultations_idempotency_uq").on(t.idempotencyKey),
    index("consultations_staff_time_idx").on(t.staffId, t.startsAt),
    index("consultations_customer_idx").on(t.customerUserId, t.startsAt),
    check("consultations_range", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);
