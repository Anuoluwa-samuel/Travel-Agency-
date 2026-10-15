CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."booking_mode" AS ENUM('instant', 'request', 'enquiry');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('style', 'purpose', 'collection');--> statement-breakpoint
CREATE TYPE "public"."departure_status" AS ENUM('open', 'limited', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."destination_kind" AS ENUM('city', 'country', 'region', 'island', 'park');--> statement-breakpoint
CREATE TYPE "public"."faq_owner" AS ENUM('destination', 'package', 'global');--> statement-breakpoint
CREATE TYPE "public"."fee_kind" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."inclusion_kind" AS ENUM('included', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."inventory_source" AS ENUM('manual', 'supplier');--> statement-breakpoint
CREATE TYPE "public"."itinerary_item_kind" AS ENUM('activity', 'transfer', 'flight', 'accommodation', 'meal', 'free_time');--> statement-breakpoint
CREATE TYPE "public"."package_option_kind" AS ENUM('room', 'addon');--> statement-breakpoint
CREATE TYPE "public"."package_availability" AS ENUM('available', 'limited', 'sold_out', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."package_date_mode" AS ENUM('fixed', 'flexible', 'custom', 'private_group');--> statement-breakpoint
CREATE TYPE "public"."policy_kind" AS ENUM('terms', 'cancellation', 'payment', 'privacy');--> statement-breakpoint
CREATE TYPE "public"."pricing_basis" AS ENUM('per_person', 'per_room', 'per_booking');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'review', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."destination_section_kind" AS ENUM('attractions', 'activities', 'tips', 'culture', 'transport', 'stay', 'food');--> statement-breakpoint
CREATE TYPE "public"."traveller_type" AS ENUM('adult', 'child', 'infant');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_currency" char(3) DEFAULT 'NGN' NOT NULL,
	"home_city" text,
	"nationality" text,
	"travel_interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"marketing_consent_at" timestamp with time zone,
	"whatsapp_consent_at" timestamp with time zone,
	"assigned_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"job_title" text,
	"department" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"phone" text,
	"phone_verified_at" timestamp with time zone,
	"locale" text DEFAULT 'en-NG' NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"iso2" char(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region_id" uuid,
	"currency" char(3),
	"calling_code" text,
	CONSTRAINT "countries_iso2_upper" CHECK ("countries"."iso2" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "destination_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"description" text,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "destination_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "destination_category_links" (
	"destination_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "destination_category_links_destination_id_category_id_pk" PRIMARY KEY("destination_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "destination_media" (
	"destination_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_hero" boolean DEFAULT false NOT NULL,
	CONSTRAINT "destination_media_destination_id_media_id_pk" PRIMARY KEY("destination_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "destination_sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"destination_id" uuid NOT NULL,
	"kind" "destination_section_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_iso2" char(2) NOT NULL,
	"city" text,
	"kind" "destination_kind" DEFAULT 'city' NOT NULL,
	"summary" text NOT NULL,
	"overview" text,
	"best_months" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"suggested_days_min" smallint,
	"suggested_days_max" smallint,
	"budget_currency" char(3),
	"daily_budget_low_minor" bigint,
	"daily_budget_mid_minor" bigint,
	"daily_budget_high_minor" bigint,
	"budget_source" text,
	"budget_checked_at" timestamp with time zone,
	"entry_guidance" text,
	"entry_guidance_source_url" text,
	"entry_guidance_checked_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destinations_days_range" CHECK ("destinations"."suggested_days_min" IS NULL OR "destinations"."suggested_days_max" IS NULL OR "destinations"."suggested_days_min" <= "destinations"."suggested_days_max"),
	CONSTRAINT "destinations_budget_currency" CHECK (("destinations"."daily_budget_low_minor" IS NULL AND "destinations"."daily_budget_mid_minor" IS NULL AND "destinations"."daily_budget_high_minor" IS NULL) OR "destinations"."budget_currency" IS NOT NULL),
	CONSTRAINT "destinations_best_months" CHECK ("destinations"."best_months" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[])
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_type" "faq_owner" NOT NULL,
	"owner_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faqs_owner_id" CHECK (("faqs"."owner_type" = 'global') = ("faqs"."owner_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "fee_kind" NOT NULL,
	"amount_minor" bigint,
	"currency" char(3),
	"basis_points" integer,
	"is_tax" boolean DEFAULT false NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fees_shape" CHECK (("fees"."kind" = 'fixed' AND "fees"."amount_minor" IS NOT NULL AND "fees"."currency" IS NOT NULL AND "fees"."basis_points" IS NULL)
       OR ("fees"."kind" = 'percent' AND "fees"."basis_points" IS NOT NULL AND "fees"."amount_minor" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "itinerary_days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"day_number" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"overnight_location" text,
	"breakfast" boolean DEFAULT false NOT NULL,
	"lunch" boolean DEFAULT false NOT NULL,
	"dinner" boolean DEFAULT false NOT NULL,
	CONSTRAINT "itinerary_days_day_positive" CHECK ("itinerary_days"."day_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"itinerary_day_id" uuid NOT NULL,
	"kind" "itinerary_item_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" time,
	"is_optional" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer,
	"height" integer,
	"credit" text,
	"licence" text,
	"source_url" text,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "package_accommodations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"star_rating" smallint,
	"nights" smallint NOT NULL,
	"room_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"meal_plan" text,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_departures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"booking_deadline" date,
	"capacity" integer NOT NULL,
	"seats_held" integer DEFAULT 0 NOT NULL,
	"seats_confirmed" integer DEFAULT 0 NOT NULL,
	"status" "departure_status" DEFAULT 'open' NOT NULL,
	"inventory_source" "inventory_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "package_departures_dates" CHECK ("package_departures"."start_date" <= "package_departures"."end_date"),
	CONSTRAINT "package_departures_deadline" CHECK ("package_departures"."booking_deadline" IS NULL OR "package_departures"."booking_deadline" <= "package_departures"."start_date"),
	CONSTRAINT "package_departures_capacity" CHECK ("package_departures"."seats_held" >= 0 AND "package_departures"."seats_confirmed" >= 0 AND "package_departures"."seats_held" + "package_departures"."seats_confirmed" <= "package_departures"."capacity")
);
--> statement-breakpoint
CREATE TABLE "package_destinations" (
	"package_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "package_destinations_package_id_destination_id_pk" PRIMARY KEY("package_id","destination_id")
);
--> statement-breakpoint
CREATE TABLE "package_inclusions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"kind" "inclusion_kind" NOT NULL,
	"text" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_media" (
	"package_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_hero" boolean DEFAULT false NOT NULL,
	CONSTRAINT "package_media_package_id_media_id_pk" PRIMARY KEY("package_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "package_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"kind" "package_option_kind" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pricing_basis" "pricing_basis" NOT NULL,
	"occupancy" smallint,
	"is_required" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "package_options_room_occupancy" CHECK ("package_options"."kind" <> 'room' OR "package_options"."occupancy" BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"primary_destination_id" uuid NOT NULL,
	"travel_style" text,
	"duration_days" smallint NOT NULL,
	"nights" smallint NOT NULL,
	"date_mode" "package_date_mode" DEFAULT 'fixed' NOT NULL,
	"booking_mode" "booking_mode" DEFAULT 'request' NOT NULL,
	"min_pax" smallint DEFAULT 1 NOT NULL,
	"max_pax" smallint DEFAULT 20 NOT NULL,
	"meeting_info" text,
	"terms_policy_id" uuid,
	"cancellation_policy_id" uuid,
	"availability" "package_availability" DEFAULT 'available' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_pax_range" CHECK ("packages"."min_pax" >= 1 AND "packages"."min_pax" <= "packages"."max_pax"),
	CONSTRAINT "packages_duration" CHECK ("packages"."duration_days" >= 1 AND "packages"."nights" >= 0 AND "packages"."nights" <= "packages"."duration_days")
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"package_id" uuid PRIMARY KEY NOT NULL,
	"deposit_basis_points" integer DEFAULT 3000 NOT NULL,
	"deposit_min_minor" bigint,
	"currency" char(3),
	"balance_due_days_before" smallint DEFAULT 45 NOT NULL,
	"instalments" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "payment_plans_deposit_bp" CHECK ("payment_plans"."deposit_basis_points" BETWEEN 0 AND 10000),
	CONSTRAINT "payment_plans_instalments" CHECK ("payment_plans"."instalments" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "policy_kind" NOT NULL,
	"key" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"rules" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"departure_id" uuid,
	"option_id" uuid,
	"traveller_type" "traveller_type" DEFAULT 'adult' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"priority" smallint DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_rules_amount_nonneg" CHECK ("price_rules"."amount_minor" >= 0),
	CONSTRAINT "price_rules_currency" CHECK ("price_rules"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "price_rules_validity" CHECK ("price_rules"."valid_from" IS NULL OR "price_rules"."valid_to" IS NULL OR "price_rules"."valid_from" <= "price_rules"."valid_to")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "regions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"from_slug" text NOT NULL,
	"to_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_roles" text[],
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_category_links" ADD CONSTRAINT "destination_category_links_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_category_links" ADD CONSTRAINT "destination_category_links_category_id_destination_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."destination_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_media" ADD CONSTRAINT "destination_media_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_media" ADD CONSTRAINT "destination_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_sections" ADD CONSTRAINT "destination_sections_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_country_iso2_countries_iso2_fk" FOREIGN KEY ("country_iso2") REFERENCES "public"."countries"("iso2") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fees" ADD CONSTRAINT "fees_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_itinerary_day_id_itinerary_days_id_fk" FOREIGN KEY ("itinerary_day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_accommodations" ADD CONSTRAINT "package_accommodations_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_departures" ADD CONSTRAINT "package_departures_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_destinations" ADD CONSTRAINT "package_destinations_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_destinations" ADD CONSTRAINT "package_destinations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_inclusions" ADD CONSTRAINT "package_inclusions_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_media" ADD CONSTRAINT "package_media_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_media" ADD CONSTRAINT "package_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_options" ADD CONSTRAINT "package_options_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_primary_destination_id_destinations_id_fk" FOREIGN KEY ("primary_destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_terms_policy_id_policies_id_fk" FOREIGN KEY ("terms_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_cancellation_policy_id_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_departure_id_package_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."package_departures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_option_id_package_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."package_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_uq" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_roles_role_idx" ON "staff_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "two_factors_user_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factors_secret_idx" ON "two_factors" USING btree ("secret");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "dcl_category_idx" ON "destination_category_links" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "destination_media_one_hero" ON "destination_media" USING btree ("destination_id") WHERE "destination_media"."is_hero";--> statement-breakpoint
CREATE INDEX "destination_sections_dest_idx" ON "destination_sections" USING btree ("destination_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "destinations_slug_uq" ON "destinations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "destinations_status_idx" ON "destinations" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "destinations_country_idx" ON "destinations" USING btree ("country_iso2");--> statement-breakpoint
CREATE INDEX "destinations_search_idx" ON "destinations" USING gin (to_tsvector('english', "name" || ' ' || coalesce("city", '') || ' ' || "summary"));--> statement-breakpoint
CREATE INDEX "faqs_owner_idx" ON "faqs" USING btree ("owner_type","owner_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "itinerary_days_package_day_uq" ON "itinerary_days" USING btree ("package_id","day_number");--> statement-breakpoint
CREATE INDEX "itinerary_items_day_idx" ON "itinerary_items" USING btree ("itinerary_day_id","position");--> statement-breakpoint
CREATE INDEX "package_departures_pkg_date_idx" ON "package_departures" USING btree ("package_id","start_date");--> statement-breakpoint
CREATE INDEX "package_inclusions_pkg_idx" ON "package_inclusions" USING btree ("package_id","kind","position");--> statement-breakpoint
CREATE UNIQUE INDEX "package_media_one_hero" ON "package_media" USING btree ("package_id") WHERE "package_media"."is_hero";--> statement-breakpoint
CREATE UNIQUE INDEX "package_options_code_uq" ON "package_options" USING btree ("package_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "packages_slug_uq" ON "packages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "packages_status_idx" ON "packages" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "packages_destination_idx" ON "packages" USING btree ("primary_destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "policies_key_version_uq" ON "policies" USING btree ("key","version");--> statement-breakpoint
CREATE INDEX "price_rules_lookup_idx" ON "price_rules" USING btree ("package_id","departure_id","option_id","traveller_type");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_redirects_from_uq" ON "slug_redirects" USING btree ("entity_type","from_slug");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_buckets_key_window_uq" ON "rate_limit_buckets" USING btree ("key","window_start");