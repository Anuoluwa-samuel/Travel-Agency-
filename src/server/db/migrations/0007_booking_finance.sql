CREATE TYPE "public"."actor_type" AS ENUM('customer', 'staff', 'system', 'provider');--> statement-breakpoint
CREATE TYPE "public"."booking_item_kind" AS ENUM('package', 'room', 'addon', 'flight', 'hotel', 'transfer', 'insurance', 'service', 'fee');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('draft', 'request_submitted', 'awaiting_supplier', 'awaiting_payment', 'partially_paid', 'confirmed', 'ticketed', 'in_progress', 'completed', 'cancellation_requested', 'cancelled', 'refund_pending', 'refunded', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."booking_type" AS ENUM('package', 'flight', 'hotel', 'custom', 'service');--> statement-breakpoint
CREATE TYPE "public"."cancellation_request_status" AS ENUM('submitted', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."confirmation_status" AS ENUM('requested', 'held', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('held', 'released', 'converted');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('price_rule', 'supplier', 'manual');--> statement-breakpoint
CREATE TYPE "public"."quote_line_kind" AS ENUM('base', 'room', 'addon', 'fee', 'tax', 'discount');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('active', 'accepted', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'partially_paid', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('charge_due', 'payment_received', 'refund_issued', 'adjustment', 'write_off');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('initialized', 'pending', 'succeeded', 'failed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('paystack', 'mock', 'manual');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'approved', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('pending', 'paid', 'overdue', 'waived');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('charge', 'refund', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verified_via" AS ENUM('webhook', 'api_verify', 'staff');--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "booking_item_kind" NOT NULL,
	"description" text NOT NULL,
	"option_id" uuid,
	"quantity" integer NOT NULL,
	"unit_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"confirmation_status" "confirmation_status" DEFAULT 'requested' NOT NULL,
	"supplier_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_id" uuid,
	"visibility" "message_visibility" DEFAULT 'internal' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_travellers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"traveller_type" "traveller_type" NOT NULL,
	"title" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth_enc" text,
	"passport_number_enc" text,
	"passport_last4" text,
	"passport_expiry" date,
	"nationality" text,
	"is_lead" smallint DEFAULT 0 NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"type" "booking_type" NOT NULL,
	"status" "booking_status" NOT NULL,
	"customer_user_id" uuid,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"quote_id" uuid,
	"package_id" uuid,
	"departure_id" uuid,
	"currency" char(3) NOT NULL,
	"total_minor" bigint NOT NULL,
	"deposit_minor" bigint NOT NULL,
	"paid_minor" bigint DEFAULT 0 NOT NULL,
	"refunded_minor" bigint DEFAULT 0 NOT NULL,
	"balance_minor" bigint GENERATED ALWAYS AS (total_minor - paid_minor + refunded_minor) STORED,
	"adults" smallint NOT NULL,
	"children" smallint DEFAULT 0 NOT NULL,
	"travel_start" date,
	"travel_end" date,
	"balance_due_date" date,
	"assigned_staff_id" uuid,
	"source" text DEFAULT 'web' NOT NULL,
	"idempotency_key" text NOT NULL,
	"cancellation_policy_id" uuid,
	"terms_policy_id" uuid,
	"expires_at" timestamp with time zone,
	"customer_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_amounts" CHECK ("bookings"."total_minor" >= 0 AND "bookings"."paid_minor" >= 0 AND "bookings"."refunded_minor" >= 0 AND "bookings"."refunded_minor" <= "bookings"."paid_minor"),
	CONSTRAINT "bookings_deposit" CHECK ("bookings"."deposit_minor" >= 0 AND "bookings"."deposit_minor" <= "bookings"."total_minor"),
	CONSTRAINT "bookings_travellers" CHECK ("bookings"."adults" >= 1 AND "bookings"."children" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"requested_by" uuid,
	"requested_by_type" "actor_type" NOT NULL,
	"previous_status" "booking_status" NOT NULL,
	"reason" text NOT NULL,
	"status" "cancellation_request_status" DEFAULT 'submitted' NOT NULL,
	"currency" char(3) NOT NULL,
	"penalty_minor" bigint NOT NULL,
	"refundable_minor" bigint NOT NULL,
	"calculation" jsonb NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cancellation_requests_amounts" CHECK ("cancellation_requests"."penalty_minor" >= 0 AND "cancellation_requests"."refundable_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "guest_access_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_holds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"departure_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"seats" smallint NOT NULL,
	"status" "hold_status" DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_holds_seats" CHECK ("inventory_holds"."seats" > 0)
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"kind" "quote_line_kind" NOT NULL,
	"description" text NOT NULL,
	"option_id" uuid,
	"traveller_type" "traveller_type",
	"quantity" integer NOT NULL,
	"unit_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"source" "price_source" NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "quote_lines_qty" CHECK ("quote_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"customer_user_id" uuid,
	"product_type" "booking_type" NOT NULL,
	"package_id" uuid,
	"departure_id" uuid,
	"input" jsonb NOT NULL,
	"currency" char(3) NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"fees_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"deposit_minor" bigint NOT NULL,
	"balance_due_date" date,
	"pricing_version" smallint DEFAULT 1 NOT NULL,
	"status" "quote_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"cancellation_policy_id" uuid,
	"terms_policy_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_totals" CHECK ("quotes"."total_minor" = "quotes"."subtotal_minor" + "quotes"."fees_minor" + "quotes"."tax_minor" AND "quotes"."total_minor" >= 0),
	CONSTRAINT "quotes_deposit" CHECK ("quotes"."deposit_minor" >= 0 AND "quotes"."deposit_minor" <= "quotes"."total_minor"),
	CONSTRAINT "quotes_accepted" CHECK (("quotes"."status" = 'accepted') = ("quotes"."accepted_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"total_minor" bigint NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_total" CHECK ("invoices"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"invoice_id" uuid,
	"transaction_id" uuid,
	"refund_id" uuid,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"memo" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_nonzero" CHECK ("ledger_entries"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'initialized' NOT NULL,
	"checkout_url" text,
	"provider_access_code" text,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_amount" CHECK ("payment_attempts"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_schedule_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "schedule_status" DEFAULT 'pending' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_schedule_amount" CHECK ("payment_schedule_items"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"transaction_id" uuid,
	"cancellation_request_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"provider_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount" CHECK ("refunds"."amount_minor" > 0),
	CONSTRAINT "refunds_four_eyes" CHECK ("refunds"."approved_by" IS NULL OR "refunds"."requested_by" IS NULL OR "refunds"."approved_by" <> "refunds"."requested_by")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_attempt_id" uuid,
	"booking_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_reference" text NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"channel" text,
	"paid_at" timestamp with time zone,
	"verified_via" "verified_via" NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount" CHECK ("transactions"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_option_id_package_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."package_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_travellers" ADD CONSTRAINT "booking_travellers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_package_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."package_departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_policy_id_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_terms_policy_id_policies_id_fk" FOREIGN KEY ("terms_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_access_codes" ADD CONSTRAINT "guest_access_codes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_departure_id_package_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."package_departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_option_id_package_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."package_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_departure_id_package_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."package_departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cancellation_policy_id_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_terms_policy_id_policies_id_fk" FOREIGN KEY ("terms_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_cancellation_request_id_cancellation_requests_id_fk" FOREIGN KEY ("cancellation_request_id") REFERENCES "public"."cancellation_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_items_booking_idx" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_notes_booking_idx" ON "booking_notes" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_status_history_booking_idx" ON "booking_status_history" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_travellers_booking_idx" ON "booking_travellers" USING btree ("booking_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_travellers_one_lead" ON "booking_travellers" USING btree ("booking_id") WHERE "booking_travellers"."is_lead" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_uq" ON "bookings" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idempotency_uq" ON "bookings" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_quote_uq" ON "bookings" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_assigned_idx" ON "bookings" USING btree ("assigned_staff_id","status");--> statement-breakpoint
CREATE INDEX "bookings_travel_start_idx" ON "bookings" USING btree ("travel_start");--> statement-breakpoint
CREATE INDEX "bookings_expires_idx" ON "bookings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cancellation_requests_booking_idx" ON "cancellation_requests" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_requests_one_open" ON "cancellation_requests" USING btree ("booking_id") WHERE "cancellation_requests"."status" = 'submitted';--> statement-breakpoint
CREATE INDEX "guest_access_codes_booking_idx" ON "guest_access_codes" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_holds_expiry_idx" ON "inventory_holds" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_holds_one_active" ON "inventory_holds" USING btree ("booking_id") WHERE "inventory_holds"."status" = 'held';--> statement-breakpoint
CREATE INDEX "quote_lines_quote_idx" ON "quote_lines" USING btree ("quote_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_reference_uq" ON "quotes" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "quotes_status_expiry_idx" ON "quotes" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_reference_uq" ON "invoices" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_one_open_per_booking" ON "invoices" USING btree ("booking_id") WHERE "invoices"."status" <> 'void';--> statement-breakpoint
CREATE INDEX "ledger_entries_booking_idx" ON "ledger_entries" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_one_per_transaction" ON "ledger_entries" USING btree ("transaction_id") WHERE "ledger_entries"."transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_reference_uq" ON "payment_attempts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_idempotency_uq" ON "payment_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_attempts_booking_idx" ON "payment_attempts" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_schedule_items_invoice_idx" ON "payment_schedule_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_reference_uq" ON "refunds" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "refunds_booking_idx" ON "refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_provider_ref_uq" ON "transactions" USING btree ("provider","provider_reference","kind");--> statement-breakpoint
CREATE INDEX "transactions_booking_idx" ON "transactions" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uq" ON "webhook_events" USING btree ("provider","event_id");