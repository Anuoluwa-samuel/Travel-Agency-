-- Append-only guard (RULES.md §3). Reused later for ledger_entries, transactions,
-- booking_status_history and document_access_logs.
CREATE OR REPLACE FUNCTION orbis_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION orbis_reject_mutation();
--> statement-breakpoint
-- TRUNCATE bypasses row triggers, so it is blocked separately.
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION orbis_reject_mutation();
