# Data Model

**Status:** Phase 1 · 2026-10-15 · PostgreSQL 16 + Drizzle ORM

This document defines every table we plan to build, grouped by domain. For each domain: ownership, access, lifecycle, and the invariants the database itself must enforce. Drizzle schema files in `src/server/db/schema/<domain>.ts` must match it.

---

## 0. Conventions

| Concern | Rule |
|---------|------|
| Primary keys | `id uuid` (UUIDv7, generated in app — time-ordered, index-friendly) |
| Public references | Separate `reference text UNIQUE` (random Crockford base32, e.g. `BK-7K3M-Q9XP`); never sequential, never the PK |
| Money | `*_minor bigint NOT NULL` + `currency char(3) NOT NULL` with `CHECK (currency ~ '^[A-Z]{3}$')` |
| Timestamps | `timestamptz`, stored UTC; every table has `created_at`, mutable tables also `updated_at` |
| Enums | Postgres enums for stable sets (booking status, roles); lookup tables for admin-configurable sets (visa case statuses, enquiry categories) |
| Soft delete | `archived_at` only where history matters (catalogue, CMS). Financial and audit tables are never deleted. Personal data deletion = anonymization job |
| Append-only | `ledger_entries`, `booking_status_history`, `audit_logs`, `document_access_logs`, `transactions` — a trigger rejects `UPDATE`/`DELETE` |
| JSON | `jsonb` only for genuinely schemaless data (provider raw payloads, AI output snapshots), always paired with a Zod schema in code |
| Sensitive fields | Passport numbers and dates of birth stored with app-level encryption (`*_enc bytea`) + `*_last4` / hash for lookup |

---

## 1. Identity & Access

**Owner:** platform. **Access:** a user reads/updates their own row; `staff.manage` for staff/roles.

| Table | Key columns | Constraints / notes |
|-------|-------------|---------------------|
| `users` | email, email_verified (bool, Better Auth), two_factor_enabled, name, phone, phone_verified_at, image, locale, timezone, status (`active`/`suspended`/`deleted`) | `UNIQUE lower(email)` |
| `accounts` | user_id, provider, provider_account_id, password_hash | Better Auth; `UNIQUE (provider, provider_account_id)` |
| `sessions` | user_id, token_hash, expires_at, ip, user_agent | Revocable; expired rows purged by job |
| `verifications` | identifier, value, expires_at | Better Auth tokens (email verification, password reset). Guest booking lookup codes get their own table in Phase 4 |
| `two_factors` | user_id, secret, backup_codes, verified, failed_verification_count, locked_until | Better Auth encrypts the secret and codes; required for privileged staff roles |
| `auth_rate_limits` | key, count, last_request | Better Auth's DB-backed limiter for sign-in, sign-up, reset and 2FA |
| `customer_profiles` | user_id (PK/FK), preferred_currency, home_city, nationality, travel_interests text[], marketing_consent_at, whatsapp_consent_at, assigned_staff_id | 1:1 with users |
| `staff_profiles` | user_id (PK/FK), job_title, department, is_active | 1:1 with users |
| `roles` | key (`super_admin`, `ops_manager`, …), name, is_system | Seeded |
| `permissions` | key (`booking.read`, …), description | Seeded from `permissions.ts` |
| `role_permissions` | role_id, permission_id | PK (role_id, permission_id) |
| `staff_roles` | user_id, role_id, granted_by, granted_at | PK (user_id, role_id); grants audited |

## 2. Catalogue

**Owner:** content editors / ops. **Access:** public reads only `status = 'published'` and `published_at <= now()`.

| Table | Key columns | Constraints / notes |
|-------|-------------|---------------------|
| `regions` | slug, name | e.g. Africa, Europe |
| `countries` | iso2 (PK), name, region_id, currency, calling_code | Seeded from ISO data |
| `destinations` | slug, name, country_iso2, city, kind (`city`/`country`/`region`/`island`), summary, overview (rich text), best_months int[], suggested_days_min/max, daily_budget_low/mid/high_minor + currency, budget_source, budget_checked_at, entry_guidance, entry_guidance_source_url, entry_guidance_checked_at, status, published_at, seo_title, seo_description | `UNIQUE slug`; status enum `draft/review/scheduled/published/archived` |
| `destination_categories` | slug, name, kind (`style`/`purpose`/`collection`) | romantic, family, adventure, beach, luxury, budget … |
| `destination_category_links` | destination_id, category_id | PK pair |
| `destination_sections` | destination_id, kind (`attractions`/`tips`/`culture`/`transport`/`stay`), title, body, position | Structured content blocks |
| `media_assets` | storage_key, alt, width, height, credit, licence, source_url, uploaded_by | Public bucket; alt required |
| `destination_media` | destination_id, media_id, position, is_hero | |
| `faqs` | owner_type (`destination`/`package`/`global`), owner_id, question, answer, position | |
| `packages` | slug, title, summary, description, destination_id (primary), travel_style, duration_days, nights, date_mode (`fixed`/`flexible`/`custom`/`private_group`), min_pax, max_pax, booking_mode (`instant`/`request`/`enquiry`), meeting_info, terms_id, cancellation_policy_id, status, published_at, availability (`available`/`limited`/`sold_out`/`unavailable`) | `CHECK (nights = duration_days - 1 OR date_mode = 'custom')`, `CHECK (min_pax <= max_pax)` |
| `package_destinations` | package_id, destination_id, position | Multi-destination tours |
| `package_media` | package_id, media_id, position, is_hero | |
| `itinerary_days` | package_id, day_number, title, description, overnight_location, meals (`B`,`L`,`D` flags) | `UNIQUE (package_id, day_number)` |
| `itinerary_items` | itinerary_day_id, kind (`activity`/`transfer`/`flight`/`accommodation`/`free_time`), title, description, start_time, is_optional, position | |
| `package_inclusions` | package_id, kind (`included`/`excluded`), text, position | |
| `package_accommodations` | package_id, name, star_rating, nights, room_types text[], meal_plan | Descriptive; real inventory via departures/suppliers |
| `package_options` | package_id, kind (`room`/`addon`), code, name, description, pricing_basis (`per_person`/`per_room`/`per_booking`), occupancy (1–4 for rooms), is_required | `UNIQUE (package_id, code)` |
| `package_departures` | package_id, start_date, end_date, booking_deadline, capacity, seats_held, seats_confirmed, status (`open`/`limited`/`closed`/`cancelled`), inventory_source (`manual`/`supplier`) | `CHECK (seats_held + seats_confirmed <= capacity)`; row-locked during booking |
| `price_rules` | package_id, departure_id (nullable = all), option_id (nullable = base), traveller_type (`adult`/`child`/`infant`), occupancy, amount_minor, currency, valid_from, valid_to, priority | Exclusion constraint on overlapping validity for same scope |
| `fees` | scope (`package`/`global`), scope_id, code, name, kind (`fixed`/`percent`), amount_minor or basis_points, currency, is_tax, is_mandatory | Taxes/fees shown in breakdown |
| `policies` | kind (`terms`/`cancellation`/`payment`), version, title, body, rules jsonb (structured cancellation tiers), published_at | Immutable once published; new version instead |
| `payment_plans` | package_id, deposit_basis_points, deposit_min_minor, balance_due_days_before, instalments int | |
| `slug_redirects` | entity_type, from_slug, to_slug | Created on slug change |

## 3. Suppliers & Inventory

**Owner:** ops / booking agents. **Access:** staff only (`supplier.manage`).

| Table | Key columns | Notes |
|-------|-------------|-------|
| `suppliers` | name, kind (`hotel`/`airline`/`dmc`/`transfer`/`insurer`/`activity`/`aggregator`), contact jsonb, contract_ref, integration_key (nullable), integration_status (`none`/`configured`/`error`), notes | |
| `supplier_offers` | supplier_id, package_id/option_id (nullable), description, net_cost_minor, currency, valid_from, valid_to, capacity | Agency cost side; never shown to customers |
| `inventory_holds` | departure_id, booking_id, seats, expires_at, status (`held`/`released`/`converted`) | Job releases expired holds and decrements `seats_held` in a tx |
| `supplier_bookings` | booking_item_id, supplier_id, supplier_reference, status, last_synced_at, raw_payload jsonb | Stores real supplier refs only |

## 4. Quoting & FX

| Table | Key columns | Notes |
|-------|-------------|-------|
| `currencies` | code (PK), exponent, symbol, is_display_enabled | NGN 2, USD 2, GBP 2, EUR 2 |
| `exchange_rate_snapshots` | base, quote, rate numeric(20,10), source, fetched_at | Indicative display only |
| `quotes` | reference, customer_user_id (nullable), contact_email, product_type, product_id, departure_id, input jsonb (validated), currency, subtotal_minor, fees_minor, tax_minor, total_minor, pricing_version, expires_at, status (`active`/`accepted`/`expired`/`superseded`), accepted_at, terms_policy_id, cancellation_policy_id | Immutable after `accepted` |
| `quote_lines` | quote_id, kind (`base`/`option`/`addon`/`fee`/`tax`/`discount`), description, traveller_type, quantity, unit_minor, total_minor, source (`price_rule`/`supplier`/`manual`) | Sum of lines = quote total (checked in service + test) |

## 5. Booking

**Owner:** customer (their own) + staff. **Access:** customer via `customer_user_id` or verified guest token; staff via `booking.read`, optionally scoped to `assigned_staff_id`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `bookings` | reference, type (`package`/`flight`/`hotel`/`custom`/`service`), status, customer_user_id (nullable), contact_name, contact_email, contact_phone, quote_id, currency, total_minor, paid_minor, refunded_minor, balance_minor (generated), assigned_staff_id, source (`web`/`admin`/`enquiry`), idempotency_key, travel_start, travel_end, cancellation_policy_id, terms_policy_id, expires_at | `UNIQUE idempotency_key`; `paid_minor`/`refunded_minor` derived from ledger and recomputed in tx |
| `booking_travellers` | booking_id, type (`adult`/`child`/`infant`), title, first_name, last_name, dob_enc, nationality, passport_number_enc, passport_last4, passport_expiry, is_lead | Sensitive fields encrypted |
| `booking_items` | booking_id, kind (`package`/`room`/`addon`/`flight`/`hotel`/`transfer`/`insurance`/`service`), description, quantity, unit_minor, total_minor, supplier_id, status, confirmation_status (`requested`/`held`/`confirmed`/`cancelled`) | |
| `booking_status_history` | booking_id, from_status, to_status, actor_type (`customer`/`staff`/`system`/`provider`), actor_id, note, created_at | Append-only |
| `cancellation_requests` | booking_id, requested_by, reason, status (`submitted`/`approved`/`rejected`/`withdrawn`), computed_penalty_minor, computed_refund_minor, policy_snapshot jsonb, decided_by, decided_at | Penalty computed by policy engine at request time |
| `booking_notes` | booking_id, author_id, visibility (`internal`/`customer`), body | |

## 6. Payments & Finance

**Owner:** finance. **Access:** customers read their own invoices/receipts; `finance.*` for staff.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `invoices` | reference, booking_id, currency, total_minor, status (`draft`/`issued`/`partially_paid`/`paid`/`void`), issued_at | |
| `payment_schedule_items` | invoice_id, label (`Deposit`, `Balance`, `Instalment 2`), amount_minor, due_at, status (`pending`/`paid`/`overdue`/`waived`) | Sum = invoice total |
| `payment_attempts` | reference, invoice_id, schedule_item_id, provider, amount_minor, currency, idempotency_key, status (`initialized`/`pending`/`succeeded`/`failed`/`abandoned`), provider_access_code, created_by | `UNIQUE idempotency_key` |
| `transactions` | payment_attempt_id, provider, provider_reference, kind (`charge`/`refund`/`reversal`), amount_minor, currency, status, channel, paid_at, raw_payload jsonb, verified_via (`webhook`/`api_verify`) | `UNIQUE (provider, provider_reference, kind)` — duplicate webhooks are no-ops; append-only |
| `refunds` | reference, booking_id, transaction_id, amount_minor, currency, reason, status (`requested`/`approved`/`processing`/`completed`/`failed`), requested_by, approved_by, provider_reference | Approver ≠ requester enforced in service |
| `ledger_entries` | booking_id, invoice_id, transaction_id, refund_id, entry_type (`charge_due`/`payment_received`/`refund_issued`/`adjustment`/`write_off`), amount_minor (signed), currency, memo, created_by | Append-only; booking balance = sum |
| `webhook_events` | provider, event_id, signature_valid, payload jsonb, received_at, processed_at, error | `UNIQUE (provider, event_id)` — replay protection |
| `reconciliation_runs` | provider, period_start, period_end, status, summary jsonb, run_by | |
| `reconciliation_items` | run_id, transaction_id, provider_reference, provider_amount_minor, internal_amount_minor, result (`matched`/`missing_internal`/`missing_provider`/`amount_mismatch`), resolution_note | Never rewrites transactions |

## 7. CRM, Consultations & Support

| Table | Key columns | Notes |
|-------|-------------|-------|
| `enquiries` | reference, category (`package`/`custom_trip`/`flight`/`hotel`/`visa`/`group`/`corporate`/`other`), status (`new`/`assigned`/`in_progress`/`awaiting_customer`/`awaiting_supplier`/`converted`/`closed`), priority, customer_user_id, contact_name/email/phone, preferred_contact, package_id, destination_id, travel_window, travellers jsonb, budget_minor, currency, message, source, utm jsonb, assigned_staff_id, follow_up_at, converted_booking_id, idempotency_key | Rate-limited creation |
| `enquiry_messages` | enquiry_id, author_type, author_id, channel (`web`/`email`/`whatsapp`/`phone`/`internal`), visibility, body | |
| `customer_interactions` | customer_user_id, staff_id, kind (`call`/`email`/`meeting`/`whatsapp`/`note`), summary, occurred_at, related_type/id | CRM timeline |
| `consultation_services` | slug, name, duration_minutes, format options, price_minor (nullable), currency, is_active | |
| `staff_availability` | staff_id, weekday, start_time, end_time, timezone | Weekly template |
| `availability_exceptions` | staff_id, starts_at, ends_at, kind (`off`/`extra`) | |
| `consultations` | reference, service_id, customer_user_id, contact…, staff_id, starts_at, ends_at, timezone, format (`video`/`phone`/`in_person`), status (`requested`/`confirmed`/`rescheduled`/`cancelled`/`completed`/`no_show`), meeting_link, enquiry_id | Exclusion constraint: no overlapping confirmed consultations per staff (`tstzrange`) |
| `support_tickets` | reference, customer_user_id, booking_id, subject, status (`open`/`pending`/`resolved`/`closed`), priority, assigned_staff_id | |
| `support_messages` | ticket_id, author_type, author_id, body, visibility | |

## 8. Group Planning

**Access:** members per role; organizer/co-organizer manage; staff with `booking.read` if group linked to a booking. Individual contribution amounts visible only to the payer and organizers.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `group_trips` | name, organizer_user_id, proposed_destination_id, date_from, date_to, budget_per_person_minor, currency, visibility (`private`/`link`), status (`planning`/`deciding`/`booking`/`booked`/`completed`/`cancelled`), linked_booking_id | |
| `group_members` | group_id, user_id (nullable until accept), invited_email, role (`organizer`/`co_organizer`/`participant`), status (`invited`/`active`/`left`/`removed`), room_preference, joined_at | `UNIQUE (group_id, user_id)`; exactly one organizer (partial unique index) |
| `group_invitations` | group_id, token_hash, email (nullable for link invites), role, max_uses, uses, expires_at, revoked_at, created_by | |
| `group_proposals` | group_id, kind (`destination`/`accommodation`/`activity`/`itinerary`), title, details jsonb, est_cost_minor, currency, proposed_by | |
| `group_polls` | group_id, question, kind (`single`/`multi`), closes_at, status (`open`/`closed`), created_by | |
| `group_poll_options` | poll_id, proposal_id (nullable), label | |
| `group_votes` | poll_id, option_id, member_id | `UNIQUE (poll_id, member_id, option_id)`; single-choice enforced by partial index |
| `group_expenses` | group_id, title, kind (`shared`/`individual`), estimate_or_actual (`estimate`/`actual`), amount_minor, currency, split_method (`equal`/`custom`/`by_room`), created_by | Estimates never charged |
| `group_expense_shares` | expense_id, member_id, amount_minor | Sum = expense amount |
| `group_contributions` | group_id, member_id, booking_id, amount_due_minor, amount_paid_minor, status | Links to real payments only via booking/invoice |
| `group_checklist_items` | group_id, text, assignee_member_id, done_at, position | |
| `group_activity` | group_id, actor_member_id, kind, payload jsonb | Activity log / decision record |

## 9. Visa & Documents

**Access:** customer owns their cases/docs; `visa.manage` for case workflow; **`document.read_private`** required to open files; every open writes `document_access_logs`.

| Table | Key columns | Notes |
|-------|-------------|-------|
| `visa_guidance` | destination_country, nationality, purpose, summary, requirements jsonb (checklist template), official_source_url, last_checked_at, checked_by, confidence (`verified`/`general`) | Shown with source + date; never "guaranteed" |
| `visa_case_statuses` | key, label, customer_label, position, is_terminal | Admin-configurable list |
| `visa_cases` | reference, customer_user_id, booking_id, destination_country, nationality, passport_type, residency_country, purpose, travel_from, travel_to, service_level (`self_guided`/`assisted`), status_key, owner_staff_id, next_deadline_at | |
| `visa_case_status_history` | case_id, from_key, to_key, actor_id, customer_note, internal_note | Append-only |
| `visa_checklist_items` | case_id, label, description, is_required, status (`todo`/`uploaded`/`accepted`/`needs_attention`/`not_applicable`), document_id, due_at | |
| `visa_case_notes` | case_id, author_id, visibility, body | |
| `private_documents` | owner_user_id, related_type (`visa_case`/`booking`/`group`), related_id, kind (`passport`/`photo`/`bank_statement`/`itinerary`/`ticket`/`other`), storage_key, original_filename, mime_type, size_bytes, sha256, scan_status (`pending`/`clean`/`infected`/`skipped`), version, supersedes_id, retention_until, deleted_at | Private bucket; never public URL |
| `document_access_logs` | document_id, actor_user_id, action (`view`/`download`/`upload`/`delete`), ip, created_at | Append-only |

## 10. Planning tools

| Table | Key columns | Notes |
|-------|-------------|-------|
| `saved_items` | user_id, item_type (`destination`/`package`), item_id | `UNIQUE (user_id, item_type, item_id)` |
| `budgets` | reference, user_id (nullable), share_token_hash, inputs jsonb, currency, total_minor, per_person_minor, fx_snapshot_id, calculated_at, formula_version | |
| `budget_lines` | budget_id, category, description, amount_minor, source (`supplier`/`configured_estimate`/`ai_estimate`), source_note, is_adjustable | |
| `budget_reference_rates` | destination_id, category, tier (`budget`/`mid`/`luxury`), unit (`per_night`/`per_day`/`per_person`/`per_trip`), amount_minor, currency, source, checked_at | Staff-configured estimate inputs |
| `ai_sessions` | user_id (nullable), anon_id, status, preferences jsonb, message_count, tokens_in, tokens_out, handoff_consent_at, handoff_enquiry_id | Rate-limited |
| `ai_messages` | session_id, role, content (redacted), created_at | No passport/payment data ever stored or sent |
| `trip_plans` | reference, user_id, ai_session_id, title, status (`draft`/`saved`/`shared`/`sent_to_consultant`), proposal jsonb (Zod-validated), schema_version, share_token_hash | Editable copy of AI proposal |

## 11. Companion

| Table | Key columns | Notes |
|-------|-------------|-------|
| `trip_checklist_items` | booking_id, phase (`before_departure`/`arrival`/`return`), text, done_at | |
| `trip_contacts` | booking_id, kind (`hotel`/`transfer`/`guide`/`agency`/`emergency`), name, phone, email, notes | |
| `external_data_snapshots` | booking_id, provider, kind (`weather`/`flight_status`/`advisory`), payload jsonb, fetched_at, expires_at | Always rendered with source + fetched_at |

## 12. Content (CMS)

| Table | Key columns | Notes |
|-------|-------------|-------|
| `articles` | slug, title, excerpt, body, hero_media_id, author_staff_id, status, published_at, seo_title, seo_description, canonical_url | |
| `article_destinations` | article_id, destination_id | Internal linking |
| `pages` | slug, kind (`legal`/`landing`/`static`), title, body, status, published_at | |
| `homepage_sections` | kind (`hero`/`collection`/`featured_packages`/`banner`/`text`), config jsonb, position, is_active, starts_at, ends_at | |
| `nav_items` | location (`header`/`footer`), label, href, parent_id, position | |
| `content_revisions` | entity_type, entity_id, snapshot jsonb, author_id | Change tracking for catalogue + CMS |

## 13. Notifications

| Table | Key columns | Notes |
|-------|-------------|-------|
| `notification_templates` | key (`booking.confirmed` …), channel, locale, subject, body, version, is_active | |
| `notification_preferences` | user_id, category (`transactional`/`reminders`/`marketing`), channel, enabled | Transactional email cannot be disabled |
| `notifications` | user_id (nullable), recipient, template_key, channel, payload jsonb, dedup_key, status (`queued`/`sent`/`failed`/`suppressed`), read_at (in-app) | `UNIQUE dedup_key` |
| `notification_deliveries` | notification_id, provider, provider_message_id, attempt, status, error, created_at | |

## 14. Platform

| Table | Key columns | Notes |
|-------|-------------|-------|
| `audit_logs` | actor_user_id, actor_role, action, entity_type, entity_id, before jsonb (redacted), after jsonb (redacted), ip, request_id, created_at | Append-only |
| `settings` | key, value jsonb, updated_by | Brand, contact, currency, timezone, deposit defaults, feature flags |
| `idempotency_keys` | key, scope, request_hash, response jsonb, created_at, expires_at | Generic replay store for server actions |
| `rate_limit_buckets` | key, window_start, count | v1 Postgres limiter |

---

## Relationships (overview)

```
users ─1:1─ customer_profiles / staff_profiles
users ─< staff_roles >─ roles ─< role_permissions >─ permissions

destinations ─< packages ─< itinerary_days ─< itinerary_items
packages ─< package_options, package_departures, price_rules, faqs, package_media
package_departures ─< inventory_holds >─ bookings

quotes ─1:1─ bookings ─< booking_travellers, booking_items, booking_status_history, cancellation_requests
bookings ─< invoices ─< payment_schedule_items
invoices ─< payment_attempts ─< transactions
bookings ─< ledger_entries >─ transactions / refunds

enquiries ─0:1─ bookings (converted)     consultations >─ consultation_services
group_trips ─< group_members, group_polls ─< group_votes, group_expenses ─< group_expense_shares
visa_cases ─< visa_checklist_items >─ private_documents ─< document_access_logs
ai_sessions ─< ai_messages;  ai_sessions ─< trip_plans
```

## Indexing plan (initial)

- `destinations (status, published_at)`, GIN on `to_tsvector(name || summary)` for search; `destination_category_links (category_id)`.
- `packages (status, destination_id)`, `package_departures (package_id, start_date)`.
- `bookings (customer_user_id, created_at desc)`, `(status)`, `(assigned_staff_id, status)`, `(travel_start)`.
- `transactions (provider, provider_reference)` unique; `ledger_entries (booking_id)`.
- `enquiries (status, assigned_staff_id)`, `(follow_up_at)`.
- `visa_cases (status_key, owner_staff_id)`, `(next_deadline_at)`.
- `notifications (user_id, read_at)`.

## Retention (defaults, configurable)

| Data | Retention |
|------|-----------|
| Private documents (visa/passport) | Delete 90 days after case closure or trip end, unless customer extends |
| AI messages | 180 days, then delete (proposals kept if saved) |
| Sessions / tokens | Purge after expiry + 30 days |
| Financial records, ledger, audit logs | Kept ≥ 6 years (confirm with accountant) — personal fields anonymized on account deletion |
| Enquiries without conversion | 24 months, then anonymize |
