-- Append-only financial and audit tables (RULES.md §3). Corrections are new rows, never edits.
CREATE TRIGGER transactions_append_only BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER transactions_no_truncate BEFORE TRUNCATE ON transactions
  FOR EACH STATEMENT EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER booking_status_history_append_only BEFORE UPDATE OR DELETE ON booking_status_history
  FOR EACH ROW EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER booking_status_history_no_truncate BEFORE TRUNCATE ON booking_status_history
  FOR EACH STATEMENT EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
-- Enquiries converted into bookings now point at a real booking row.
ALTER TABLE enquiries ADD CONSTRAINT enquiries_converted_booking_fk
  FOREIGN KEY (converted_booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
