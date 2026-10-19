CREATE TYPE "public"."consultation_format" AS ENUM('video', 'phone', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('requested', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_exceptions_range" CHECK ("availability_exceptions"."starts_at" < "availability_exceptions"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "consultation_service_staff" (
	"service_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	CONSTRAINT "consultation_service_staff_service_id_staff_id_pk" PRIMARY KEY("service_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "consultation_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"formats" "consultation_format"[] NOT NULL,
	"price_minor" bigint,
	"currency" char(3),
	"is_active" boolean DEFAULT true NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultation_services_slug_unique" UNIQUE("slug"),
	CONSTRAINT "consultation_services_duration" CHECK ("consultation_services"."duration_minutes" BETWEEN 15 AND 240),
	CONSTRAINT "consultation_services_formats" CHECK (cardinality("consultation_services"."formats") >= 1),
	CONSTRAINT "consultation_services_price" CHECK ("consultation_services"."price_minor" IS NULL OR ("consultation_services"."price_minor" > 0 AND "consultation_services"."currency" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"service_id" uuid NOT NULL,
	"customer_user_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"customer_timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"format" "consultation_format" NOT NULL,
	"status" "consultation_status" DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"meeting_link" text,
	"enquiry_id" uuid,
	"idempotency_key" text NOT NULL,
	"confirmation_sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultations_range" CHECK ("consultations"."starts_at" < "consultations"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "staff_availability" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	CONSTRAINT "staff_availability_weekday" CHECK ("staff_availability"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "staff_availability_range" CHECK ("staff_availability"."start_time" < "staff_availability"."end_time")
);
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_service_staff" ADD CONSTRAINT "consultation_service_staff_service_id_consultation_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."consultation_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_service_staff" ADD CONSTRAINT "consultation_service_staff_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_service_id_consultation_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."consultation_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exceptions_staff_idx" ON "availability_exceptions" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_reference_uq" ON "consultations" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_idempotency_uq" ON "consultations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "consultations_staff_time_idx" ON "consultations" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "consultations_customer_idx" ON "consultations" USING btree ("customer_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "staff_availability_staff_idx" ON "staff_availability" USING btree ("staff_id","weekday");