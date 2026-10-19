CREATE TYPE "public"."contact_method" AS ENUM('email', 'phone', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."enquiry_category" AS ENUM('package', 'custom_trip', 'flight', 'hotel', 'visa', 'group', 'corporate', 'other');--> statement-breakpoint
CREATE TYPE "public"."enquiry_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'assigned', 'in_progress', 'awaiting_customer', 'awaiting_supplier', 'converted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."message_author" AS ENUM('customer', 'staff', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('web', 'email', 'whatsapp', 'phone', 'internal');--> statement-breakpoint
CREATE TYPE "public"."message_visibility" AS ENUM('internal', 'customer');--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"category" "enquiry_category" NOT NULL,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"priority" "enquiry_priority" DEFAULT 'normal' NOT NULL,
	"customer_user_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"preferred_contact" "contact_method" DEFAULT 'email' NOT NULL,
	"package_id" uuid,
	"destination_id" uuid,
	"destination_text" text,
	"departure_city" text,
	"travel_from" date,
	"travel_to" date,
	"flexible_dates" text,
	"adults" smallint DEFAULT 1 NOT NULL,
	"children" smallint DEFAULT 0 NOT NULL,
	"budget_minor" bigint,
	"budget_currency" char(3),
	"message" text NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"attribution" jsonb,
	"marketing_consent_at" timestamp with time zone,
	"assigned_staff_id" uuid,
	"follow_up_at" timestamp with time zone,
	"converted_booking_id" uuid,
	"idempotency_key" text NOT NULL,
	"acknowledgement_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_travellers" CHECK ("enquiries"."adults" BETWEEN 0 AND 99 AND "enquiries"."children" BETWEEN 0 AND 99 AND "enquiries"."adults" + "enquiries"."children" >= 1),
	CONSTRAINT "enquiries_dates" CHECK ("enquiries"."travel_from" IS NULL OR "enquiries"."travel_to" IS NULL OR "enquiries"."travel_from" <= "enquiries"."travel_to"),
	CONSTRAINT "enquiries_budget" CHECK ("enquiries"."budget_minor" IS NULL OR ("enquiries"."budget_minor" > 0 AND "enquiries"."budget_currency" IS NOT NULL)),
	CONSTRAINT "enquiries_converted" CHECK ("enquiries"."status" <> 'converted' OR "enquiries"."converted_booking_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "enquiry_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"author_type" "message_author" NOT NULL,
	"author_id" uuid,
	"channel" "message_channel" NOT NULL,
	"visibility" "message_visibility" DEFAULT 'customer' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_messages" ADD CONSTRAINT "enquiry_messages_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_messages" ADD CONSTRAINT "enquiry_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enquiries_reference_uq" ON "enquiries" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "enquiries_idempotency_uq" ON "enquiries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status","assigned_staff_id");--> statement-breakpoint
CREATE INDEX "enquiries_follow_up_idx" ON "enquiries" USING btree ("follow_up_at");--> statement-breakpoint
CREATE INDEX "enquiries_customer_idx" ON "enquiries" USING btree ("customer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "enquiry_messages_enquiry_idx" ON "enquiry_messages" USING btree ("enquiry_id","created_at");