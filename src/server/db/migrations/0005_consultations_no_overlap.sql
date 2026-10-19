-- A consultant can't be in two active consultations at once (state-machines.md §6).
-- Enforced by the database so concurrent bookings of the same slot can't both succeed.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_no_overlap"
  EXCLUDE USING gist ("staff_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('requested', 'confirmed', 'rescheduled'));
