# Engineering Rules

These rules apply to every change. When a rule conflicts with speed, the rule wins.

## 1. Integrity (non-negotiable)

1. Never show a fake success for a real operation (booking, payment, search, supplier confirmation, visa submission, message delivery).
2. Never trust the browser for prices, permissions, payment status or booking status. Recompute or re-read on the server.
3. Never invent external API capabilities. Adapters declare `capabilities`; callers check them.
4. Mock adapters are dev/test only and must render a visible **"Simulated data"** badge.
5. Never fabricate reviews, ratings, testimonials, awards, accreditation, partnerships, customer counts, addresses or licences.
6. Label every cost as **Supplier price**, **Configured estimate**, or **AI estimate**, with source and timestamp where known.
7. Never promise visa approval, guaranteed entry or appointment availability.
8. Missing credentials → build the boundary, mock adapter, setup docs and an honest fallback. Mark "awaiting configuration".

## 2. Code organisation

- Business logic lives in `src/server/services/*`. Components, server actions and route handlers stay thin.
- Every service entry point starts with an auth/permission check (`requireUser`, `requireStaff(perm)`, `assertCanAccess`).
- Zod schemas are shared between forms and server; parse all external input (forms, params, webhooks, AI output).
- No business rule hardcoded in a presentation component.
- One domain = one schema file + one service folder. Cross-domain calls go through service functions, not direct table writes.
- TypeScript `strict`, no `any` without a comment explaining why.
- Prefer server components; add `"use client"` only for interactivity.

## 3. Data and money

- Money: `bigint` minor units + ISO 4217 currency. Never floats. Use `src/server/lib/money.ts`.
- Ledger and status history tables are append-only. Corrections are new rows.
- Use DB transactions for multi-row consistency (booking + items + holds; payment + ledger + balance).
- Unique constraints back every idempotency guarantee (`(provider, provider_reference)`, `idempotency_key`, notification `dedup_key`).
- Timestamps stored as `timestamptz` (UTC); displayed in the user's or business timezone.
- Migrations are generated, reviewed and committed. No destructive migration without a written plan in the PR.
- Seed data is clearly fictional (e.g. "Demo Traveller", `@example.com`).

## 4. Security and privacy

- No secret in client bundles; only intentionally public values use `NEXT_PUBLIC_`.
- Private documents: private bucket, short-lived signed URLs, access logged, never in logs or AI prompts.
- Do not log passport numbers, document contents, card data, tokens or full addresses. Use the redacting logger.
- Never store raw card numbers or CVV.
- Rate-limit auth, enquiry, lookup, AI and upload endpoints.
- Verify webhook signatures before parsing payloads.
- Sensitive staff actions (refunds, role changes, document access, status overrides, settings) write to `audit_logs`.
- Least privilege: agents do not get finance admin, unrestricted documents or settings by default.
- Do not claim compliance or certification without evidence.

## 5. Permission matrix (v1)

| Permission | Super admin | Ops mgr | Booking agent | Consultant | Finance | Visa officer | Content editor | Support |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| booking.read | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ |
| booking.update_status | ✓ | ✓ | ✓ | ✓ | – | – | – | – |
| booking.assign | ✓ | ✓ | – | – | – | – | – | – |
| enquiry.manage | ✓ | ✓ | ✓ | ✓ | – | – | – | ✓ |
| customer.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| customer.export | ✓ | ✓ | – | – | – | – | – | – |
| catalogue.edit | ✓ | ✓ | – | – | – | – | ✓ | – |
| catalogue.publish | ✓ | ✓ | – | – | – | – | ✓ | – |
| pricing.edit | ✓ | ✓ | – | – | ✓ | – | – | – |
| supplier.manage | ✓ | ✓ | ✓ | – | – | – | – | – |
| finance.read | ✓ | ✓ | – | – | ✓ | – | – | – |
| finance.refund | ✓ | – | – | – | ✓ | – | – | – |
| finance.reconcile | ✓ | – | – | – | ✓ | – | – | – |
| visa.manage | ✓ | ✓ | – | – | – | ✓ | – | – |
| document.read_private | ✓ | – | – | – | – | ✓ | – | – |
| consultation.manage | ✓ | ✓ | – | ✓ | – | ✓ | – | ✓ |
| content.manage | ✓ | ✓ | – | – | – | – | ✓ | – |
| support.manage | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | ✓ |
| analytics.read | ✓ | ✓ | – | – | ✓ | – | – | – |
| staff.manage | ✓ | – | – | – | – | – | – | – |
| settings.manage | ✓ | – | – | – | – | – | – | – |
| audit.read | ✓ | ✓ | – | – | – | – | – | – |

Assigned-only scoping (agent sees only assigned bookings/cases) is a configurable setting.

## 6. UX rules

- Every async view has loading, empty, error and success states.
- No button without a real action. Disabled states explain why.
- Forms: visible labels, inline errors, error summary on submit, preserve input on failure.
- Distinguish **confirmed**, **proposed** and **estimated** visually (see `DESIGN.md` status tokens).
- Mobile first. Check 360px, 768px, 1280px before calling UI done.
- Respect `prefers-reduced-motion`.

## 7. Testing

- Unit: pricing, money, currency conversion, transitions, permissions, budget formulas, validation.
- Integration: DB ops, auth, booking creation, payment verify + webhook idempotency, document access, notifications.
- E2E (Playwright): the 18 journeys in the master brief, tracked in `TASKS.md`.
- External services always mocked in tests. No real charges, bookings or messages.
- A bug fix comes with a test that fails without it.

## 8. Git workflow

- `.claude/` is git-ignored and must never be committed or pushed.
- `.env*` files are ignored; only `.env.example` is committed.
- Branch per phase/feature (`phase-2/foundation`, `feat/booking-state-machine`), PR into `main`.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).
- Before every commit: `pnpm lint && pnpm typecheck && pnpm test`.
- Update `TASKS.md` and `MEMORY.md` at the end of each phase.

## 9. Definition of Done (per feature)

- [ ] User journey implemented end to end (UI → service → DB)
- [ ] Inputs validated client and server
- [ ] Server enforces business rules and authorization
- [ ] Data persists correctly; constraints in place
- [ ] Loading / empty / success / error states
- [ ] Notifications sent where required
- [ ] Edge cases handled (duplicates, expiry, concurrency, failures)
- [ ] Automated tests cover critical behaviour and pass
- [ ] Docs updated
- [ ] Checked at mobile, tablet, desktop widths
