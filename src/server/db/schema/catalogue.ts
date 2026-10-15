import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  char,
  date,
  index,
  integer,
  jsonb,
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
import { users } from "./identity";

/*
 * Catalogue (data-model §2). Public reads only return rows with status = 'published' and
 * published_at <= now(); that filter lives in the catalogue service, not in UI code.
 */

export const publicationStatus = pgEnum("publication_status", [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
]);

export const destinationKind = pgEnum("destination_kind", ["city", "country", "region", "island", "park"]);
export const categoryKind = pgEnum("category_kind", ["style", "purpose", "collection"]);
export const sectionKind = pgEnum("destination_section_kind", [
  "attractions",
  "activities",
  "tips",
  "culture",
  "transport",
  "stay",
  "food",
]);
export const faqOwner = pgEnum("faq_owner", ["destination", "package", "global"]);

export const packageDateMode = pgEnum("package_date_mode", ["fixed", "flexible", "custom", "private_group"]);
export const bookingMode = pgEnum("booking_mode", ["instant", "request", "enquiry"]);
export const packageAvailability = pgEnum("package_availability", ["available", "limited", "sold_out", "unavailable"]);
export const itineraryItemKind = pgEnum("itinerary_item_kind", [
  "activity",
  "transfer",
  "flight",
  "accommodation",
  "meal",
  "free_time",
]);
export const inclusionKind = pgEnum("inclusion_kind", ["included", "excluded"]);
export const optionKind = pgEnum("package_option_kind", ["room", "addon"]);
export const pricingBasis = pgEnum("pricing_basis", ["per_person", "per_room", "per_booking"]);
export const travellerType = pgEnum("traveller_type", ["adult", "child", "infant"]);
export const departureStatus = pgEnum("departure_status", ["open", "limited", "closed", "cancelled"]);
export const inventorySource = pgEnum("inventory_source", ["manual", "supplier"]);
export const feeKind = pgEnum("fee_kind", ["fixed", "percent"]);
export const policyKind = pgEnum("policy_kind", ["terms", "cancellation", "payment", "privacy"]);

// ─── Geography ────────────────────────────────────────────────────────────────

export const regions = pgTable("regions", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  position: smallint("position").notNull().default(0),
});

export const countries = pgTable(
  "countries",
  {
    iso2: char("iso2", { length: 2 }).primaryKey(),
    name: text("name").notNull(),
    regionId: uuid("region_id").references(() => regions.id, { onDelete: "set null" }),
    currency: currency("currency"),
    callingCode: text("calling_code"),
  },
  (t) => [check("countries_iso2_upper", sql`${t.iso2} ~ '^[A-Z]{2}$'`)],
);

// ─── Media ────────────────────────────────────────────────────────────────────

export const mediaAssets = pgTable("media_assets", {
  id: id(),
  storageKey: text("storage_key").notNull().unique(),
  alt: text("alt").notNull(),
  width: integer("width"),
  height: integer("height"),
  credit: text("credit"),
  licence: text("licence"),
  sourceUrl: text("source_url"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ─── Destinations ─────────────────────────────────────────────────────────────

export const destinations = pgTable(
  "destinations",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    countryIso2: char("country_iso2", { length: 2 })
      .notNull()
      .references(() => countries.iso2),
    city: text("city"),
    kind: destinationKind("kind").notNull().default("city"),
    summary: text("summary").notNull(),
    overview: text("overview"),
    bestMonths: smallint("best_months")
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    suggestedDaysMin: smallint("suggested_days_min"),
    suggestedDaysMax: smallint("suggested_days_max"),
    budgetCurrency: currency("budget_currency"),
    dailyBudgetLowMinor: minor("daily_budget_low_minor"),
    dailyBudgetMidMinor: minor("daily_budget_mid_minor"),
    dailyBudgetHighMinor: minor("daily_budget_high_minor"),
    budgetSource: text("budget_source"),
    budgetCheckedAt: tstz("budget_checked_at"),
    entryGuidance: text("entry_guidance"),
    entryGuidanceSourceUrl: text("entry_guidance_source_url"),
    entryGuidanceCheckedAt: tstz("entry_guidance_checked_at"),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: publicationStatus("status").notNull().default("draft"),
    publishedAt: tstz("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    archivedAt: tstz("archived_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("destinations_slug_uq").on(t.slug),
    index("destinations_status_idx").on(t.status, t.publishedAt),
    index("destinations_country_idx").on(t.countryIso2),
    index("destinations_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.name} || ' ' || coalesce(${t.city}, '') || ' ' || ${t.summary})`,
    ),
    check(
      "destinations_days_range",
      sql`${t.suggestedDaysMin} IS NULL OR ${t.suggestedDaysMax} IS NULL OR ${t.suggestedDaysMin} <= ${t.suggestedDaysMax}`,
    ),
    check(
      "destinations_budget_currency",
      sql`(${t.dailyBudgetLowMinor} IS NULL AND ${t.dailyBudgetMidMinor} IS NULL AND ${t.dailyBudgetHighMinor} IS NULL) OR ${t.budgetCurrency} IS NOT NULL`,
    ),
    check("destinations_best_months", sql`${t.bestMonths} <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]`),
  ],
);

export const destinationCategories = pgTable("destination_categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: categoryKind("kind").notNull(),
  description: text("description"),
  position: smallint("position").notNull().default(0),
});

export const destinationCategoryLinks = pgTable(
  "destination_category_links",
  {
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => destinationCategories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.destinationId, t.categoryId] }), index("dcl_category_idx").on(t.categoryId)],
);

export const destinationSections = pgTable(
  "destination_sections",
  {
    id: id(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    kind: sectionKind("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("destination_sections_dest_idx").on(t.destinationId, t.position)],
);

export const destinationMedia = pgTable(
  "destination_media",
  {
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
    isHero: boolean("is_hero").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.destinationId, t.mediaId] }),
    uniqueIndex("destination_media_one_hero")
      .on(t.destinationId)
      .where(sql`${t.isHero}`),
  ],
);

export const faqs = pgTable(
  "faqs",
  {
    id: id(),
    ownerType: faqOwner("owner_type").notNull(),
    ownerId: uuid("owner_id"),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("faqs_owner_idx").on(t.ownerType, t.ownerId, t.position),
    check("faqs_owner_id", sql`(${t.ownerType} = 'global') = (${t.ownerId} IS NULL)`),
  ],
);

// ─── Policies ─────────────────────────────────────────────────────────────────

/** Versioned, immutable once published: bookings reference the exact version accepted. */
export const policies = pgTable(
  "policies",
  {
    id: id(),
    kind: policyKind("kind").notNull(),
    key: text("key").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Structured rules, e.g. cancellation tiers; validated by a Zod schema per kind. */
    rules: jsonb("rules"),
    publishedAt: tstz("published_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("policies_key_version_uq").on(t.key, t.version)],
);

// ─── Packages ─────────────────────────────────────────────────────────────────

export const packages = pgTable(
  "packages",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    description: text("description"),
    primaryDestinationId: uuid("primary_destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "restrict" }),
    travelStyle: text("travel_style"),
    durationDays: smallint("duration_days").notNull(),
    nights: smallint("nights").notNull(),
    dateMode: packageDateMode("date_mode").notNull().default("fixed"),
    bookingMode: bookingMode("booking_mode").notNull().default("request"),
    minPax: smallint("min_pax").notNull().default(1),
    maxPax: smallint("max_pax").notNull().default(20),
    meetingInfo: text("meeting_info"),
    termsPolicyId: uuid("terms_policy_id").references(() => policies.id),
    cancellationPolicyId: uuid("cancellation_policy_id").references(() => policies.id),
    availability: packageAvailability("availability").notNull().default("available"),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: publicationStatus("status").notNull().default("draft"),
    publishedAt: tstz("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    archivedAt: tstz("archived_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("packages_slug_uq").on(t.slug),
    index("packages_status_idx").on(t.status, t.publishedAt),
    index("packages_destination_idx").on(t.primaryDestinationId),
    check("packages_pax_range", sql`${t.minPax} >= 1 AND ${t.minPax} <= ${t.maxPax}`),
    check("packages_duration", sql`${t.durationDays} >= 1 AND ${t.nights} >= 0 AND ${t.nights} <= ${t.durationDays}`),
  ],
);

export const packageDestinations = pgTable(
  "package_destinations",
  {
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.destinationId] })],
);

export const packageMedia = pgTable(
  "package_media",
  {
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
    isHero: boolean("is_hero").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.packageId, t.mediaId] }),
    uniqueIndex("package_media_one_hero")
      .on(t.packageId)
      .where(sql`${t.isHero}`),
  ],
);

export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: id(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    dayNumber: smallint("day_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    overnightLocation: text("overnight_location"),
    breakfast: boolean("breakfast").notNull().default(false),
    lunch: boolean("lunch").notNull().default(false),
    dinner: boolean("dinner").notNull().default(false),
  },
  (t) => [
    uniqueIndex("itinerary_days_package_day_uq").on(t.packageId, t.dayNumber),
    check("itinerary_days_day_positive", sql`${t.dayNumber} >= 1`),
  ],
);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: id(),
    itineraryDayId: uuid("itinerary_day_id")
      .notNull()
      .references(() => itineraryDays.id, { onDelete: "cascade" }),
    kind: itineraryItemKind("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startTime: time("start_time"),
    isOptional: boolean("is_optional").notNull().default(false),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("itinerary_items_day_idx").on(t.itineraryDayId, t.position)],
);

export const packageInclusions = pgTable(
  "package_inclusions",
  {
    id: id(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    kind: inclusionKind("kind").notNull(),
    text: text("text").notNull(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("package_inclusions_pkg_idx").on(t.packageId, t.kind, t.position)],
);

export const packageAccommodations = pgTable("package_accommodations", {
  id: id(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  starRating: smallint("star_rating"),
  nights: smallint("nights").notNull(),
  roomTypes: text("room_types")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  mealPlan: text("meal_plan"),
  position: smallint("position").notNull().default(0),
});

export const packageOptions = pgTable(
  "package_options",
  {
    id: id(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    kind: optionKind("kind").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    pricingBasis: pricingBasis("pricing_basis").notNull(),
    /** Number of people a room option sleeps (1 = single, 2 = twin/double…). */
    occupancy: smallint("occupancy"),
    isRequired: boolean("is_required").notNull().default(false),
    position: smallint("position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("package_options_code_uq").on(t.packageId, t.code),
    check("package_options_room_occupancy", sql`${t.kind} <> 'room' OR ${t.occupancy} BETWEEN 1 AND 6`),
  ],
);

export const packageDepartures = pgTable(
  "package_departures",
  {
    id: id(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    bookingDeadline: date("booking_deadline"),
    capacity: integer("capacity").notNull(),
    seatsHeld: integer("seats_held").notNull().default(0),
    seatsConfirmed: integer("seats_confirmed").notNull().default(0),
    status: departureStatus("status").notNull().default("open"),
    inventorySource: inventorySource("inventory_source").notNull().default("manual"),
    ...timestamps(),
  },
  (t) => [
    index("package_departures_pkg_date_idx").on(t.packageId, t.startDate),
    check("package_departures_dates", sql`${t.startDate} <= ${t.endDate}`),
    check("package_departures_deadline", sql`${t.bookingDeadline} IS NULL OR ${t.bookingDeadline} <= ${t.startDate}`),
    // Overselling guard: enforced by the database, not only by the service.
    check(
      "package_departures_capacity",
      sql`${t.seatsHeld} >= 0 AND ${t.seatsConfirmed} >= 0 AND ${t.seatsHeld} + ${t.seatsConfirmed} <= ${t.capacity}`,
    ),
  ],
);

/**
 * Prices are computed only from these rules on the server (PRD §6.2, RULES.md §1.2).
 * A null departure_id applies to all departures; a null option_id is the base price.
 * Higher priority wins when several rules match.
 */
export const priceRules = pgTable(
  "price_rules",
  {
    id: id(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    departureId: uuid("departure_id").references(() => packageDepartures.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => packageOptions.id, { onDelete: "cascade" }),
    travellerType: travellerType("traveller_type").notNull().default("adult"),
    amountMinor: minor("amount_minor").notNull(),
    currency: currency().notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    priority: smallint("priority").notNull().default(0),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [
    index("price_rules_lookup_idx").on(t.packageId, t.departureId, t.optionId, t.travellerType),
    check("price_rules_amount_nonneg", sql`${t.amountMinor} >= 0`),
    check("price_rules_currency", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check(
      "price_rules_validity",
      sql`${t.validFrom} IS NULL OR ${t.validTo} IS NULL OR ${t.validFrom} <= ${t.validTo}`,
    ),
  ],
);

export const fees = pgTable(
  "fees",
  {
    id: id(),
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: feeKind("kind").notNull(),
    amountMinor: minor("amount_minor"),
    currency: currency(),
    basisPoints: integer("basis_points"),
    isTax: boolean("is_tax").notNull().default(false),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check(
      "fees_shape",
      sql`(${t.kind} = 'fixed' AND ${t.amountMinor} IS NOT NULL AND ${t.currency} IS NOT NULL AND ${t.basisPoints} IS NULL)
       OR (${t.kind} = 'percent' AND ${t.basisPoints} IS NOT NULL AND ${t.amountMinor} IS NULL)`,
    ),
  ],
);

export const paymentPlans = pgTable(
  "payment_plans",
  {
    packageId: uuid("package_id")
      .primaryKey()
      .references(() => packages.id, { onDelete: "cascade" }),
    depositBasisPoints: integer("deposit_basis_points").notNull().default(3000),
    depositMinMinor: minor("deposit_min_minor"),
    currency: currency(),
    balanceDueDaysBefore: smallint("balance_due_days_before").notNull().default(45),
    instalments: smallint("instalments").notNull().default(1),
  },
  (t) => [
    check("payment_plans_deposit_bp", sql`${t.depositBasisPoints} BETWEEN 0 AND 10000`),
    check("payment_plans_instalments", sql`${t.instalments} BETWEEN 1 AND 12`),
  ],
);

export const slugRedirects = pgTable(
  "slug_redirects",
  {
    id: id(),
    entityType: text("entity_type").notNull(),
    fromSlug: text("from_slug").notNull(),
    toSlug: text("to_slug").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("slug_redirects_from_uq").on(t.entityType, t.fromSlug)],
);
