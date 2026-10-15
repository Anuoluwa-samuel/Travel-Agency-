# Tasks & Phases

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[cfg]` built, awaiting external configuration · `[sim]` simulated adapter only

**Total phases: 8** (Phase 0 planning + Phases 1–7 from the master brief)

| # | Phase | Outcome |
|---|-------|---------|
| 0 | Project setup & planning docs | Repo, ignore rules, PRD/Architecture/Rules/Design/Tasks/Memory |
| 1 | Discovery & architecture | Final domain model, ERD, route map, permission matrix, journeys, ADRs |
| 2 | Design system & foundation | Next.js scaffold, tokens, components, auth, DB schema, migrations, RBAC, logging |
| 3 | Public travel experience | Homepage, destinations, packages, search/filters, contact, consultations, SEO, CMS base |
| 4 | Booking & payments | Quotes, booking flow, state machine, guest lookup, Paystack, webhooks, receipts, cancellations/refunds |
| 5 | Customer portal & operations | Customer dashboard, admin bookings, CRM, catalogue admin, suppliers, finance, notifications, audit |
| 6 | Advanced travel features | Group planning, visa readiness, secure documents, budget calculator, AI planner, companion, external data |
| 7 | Quality & launch readiness | E2E suite, a11y, responsive, security review, performance, deployment, docs, launch checklist |

---

## Phase 0 — Project setup & planning docs
- [x] Create `Downloads/travel agency` and clone `Anuoluwa-samuel/Travel-Agency-` (empty repo → fresh build)
- [x] `.gitignore` excluding `.claude/`, `.env*`, build output
- [x] PRD.md, ARCHITECTURE.md, RULES.md, DESIGN.md, TASKS.md, MEMORY.md
- [x] Initial commit and push to `main`

## Phase 1 — Discovery & architecture
- [x] Full data model (all entities from master brief §20) with ownership, lifecycle, constraints → `docs/data-model.md`
- [x] Booking, quote, payment, refund, enquiry, consultation, visa, content, group state machines → `docs/state-machines.md`
- [x] 18 core user journeys mapped to routes + server checks → `docs/journeys.md`
- [x] Final route map + navigation structure (public, account, admin) → `docs/journeys.md`
- [x] Permission matrix confirmed (RULES.md §5; per-route permissions in `docs/journeys.md`)
- [x] Integration inventory + launch credentials checklist → `docs/integrations.md`
- [x] Configurable assumptions register → `docs/assumptions.md`

## Phase 2 — Design system & foundation
- [x] Scaffold Next.js 16 (App Router, Cache Components, TS strict), pnpm, ESLint, Prettier, Vitest
- [~] Playwright installed; config and E2E journeys land with the flows they test (Phase 3+)
- [x] `env.ts` validated config (`APP_ENV` tiers); `.env.example`
- [x] Tailwind tokens from DESIGN.md; fonts (Fraunces, Inter); shadcn/ui (Radix) themed; 44px touch targets
- [x] Core components: Button (+ gold accent), inputs, Badge, StatusBadge, SimulatedDataBadge, PriceTag, EmptyState, ErrorState, Skeleton, Toasts, TextField, FormAlert
- [ ] Domain components moved to the phase that first uses them: DatePicker + TravellerPicker (Phase 3), DataTable + Timeline (Phase 4/5)
- [x] Layouts: public header/footer (responsive, live-links-only nav), account shell, admin shell (permission-filtered)
- [x] Brand config (ORBIS) + `settings` table
- [x] Postgres via Docker Compose (port 5544); Drizzle schema for identity, catalogue, platform; 3 migrations; append-only trigger on `audit_logs`
- [x] Better Auth: sign up, verify email, sign in, reset password, change password, sessions, TOTP 2FA + backup codes, DB rate limits
- [x] RBAC: roles, permissions, `requireUser` / `requireStaff` (enforces 2FA for privileged roles) / `assertCanAccess`
- [x] Logger with PII redaction, error boundary, 404 page
- [ ] Request IDs + audit log write service (table and trigger exist; service lands with the first audited action in Phase 4)
- [x] Money (bigint minor units, banker's rounding, allocation, FX), reference and UUIDv7 libs with unit tests
- [ ] Idempotency helper (table exists; built with booking/payment in Phase 4)
- [x] Seed script (fictional data, idempotent, refuses to run in staging/production)
- [x] Security headers + CSP baseline; Proxy redirect for signed-out visitors; robots.txt
- [x] Tests: 57 unit + 16 integration passing; production build passing
- [x] GitHub Actions CI: lint, typecheck, tests (Postgres service), migrations, build on every PR

## Phase 3 — Public travel experience
- [ ] Homepage (hero, search, curated collections, featured packages, trust content — no fabricated claims)
- [ ] Destination listing: search, multi-filter, sort, pagination, reset, empty state
- [ ] Destination detail pages (SSG/ISR)
- [ ] Package listing + detail (structured itinerary, inclusions, departures, options, terms, FAQs)
- [ ] Enquiry form + reference + acknowledgement email
- [ ] Consultation booking (internal scheduling, timezone-aware)
- [ ] Contact, FAQs, legal pages, guides/articles
- [ ] SEO: metadata, canonicals, sitemap, robots, OG, JSON-LD where accurate, breadcrumbs, redirects
- [ ] Flights/hotels pages with honest enquiry fallback when unconfigured

## Phase 4 — Booking & payments
- [ ] Price rules engine + server quote calculation + quote expiry
- [ ] Booking flow (select → configure → validate → travellers → review → pay/request)
- [ ] Booking state machine + status history + transitions tests
- [ ] Inventory holds with expiry job; overselling protection
- [ ] Idempotency on booking + payment init
- [ ] Paystack adapter (init, verify, webhook HMAC), mock adapter
- [ ] Invoices, payment schedules (deposit/instalments), transactions, append-only ledger
- [ ] Receipts/invoice PDFs
- [ ] Guest booking lookup (OTP / magic link)
- [ ] Cancellation requests + policy calculation + refunds workflow
- [ ] Reconciliation records

## Phase 5 — Customer portal & operations
- [ ] Customer dashboard, bookings, payments, saved items, settings, support tickets
- [ ] Admin overview dashboard (booked vs collected vs outstanding vs refunded)
- [ ] Admin bookings: search, filters, timeline, assignment, supplier refs, status updates
- [ ] CRM: enquiries pipeline, customer profiles, interactions, follow-ups
- [ ] Catalogue admin: destinations, packages (structured editors), departures, preview, publish workflow
- [ ] Suppliers & inventory admin
- [ ] Finance: transactions, refunds, invoices, reconciliation, reports, exports
- [ ] Notification service: templates, pg-boss jobs, dedup, delivery tracking, preferences
- [ ] Staff & roles admin, audit log viewer, business settings
- [ ] CMS: guides, FAQs, homepage sections, banners, SEO metadata, navigation

## Phase 6 — Advanced travel features
- [ ] Group trips: create, invites, roles, proposals, polls + deadlines, expenses, contributions, checklist, activity log, export
- [ ] Visa readiness: intake, checklist, sources + last-checked, case management, statuses, notes
- [ ] Secure documents: private storage, signed URLs, validation, versioning, access log
- [ ] Budget calculator: categories, formulas, target budget, alternatives, save/share/export/convert
- [ ] AI planner: intake, Claude adapter, Zod-validated proposal, edit/save/compare/share, human handoff, rate limits
- [ ] Travel companion: trip dashboard, checklists, contacts, weather/flight-status/advisory adapters with fallbacks
- [ ] Flight/hotel supplier adapters (mock + first real provider when credentials exist)

## Phase 7 — Quality & launch readiness
- [ ] E2E journeys 1–18 (master brief §24)
- [ ] Accessibility review (axe + manual keyboard/screen reader)
- [ ] Responsive pass (360 / 768 / 1280)
- [ ] Security review (authz, IDOR, uploads, headers, rate limits, deps audit)
- [ ] Performance (CWV, query review, caching)
- [ ] Failure-mode testing for each integration
- [ ] Deployment config (web + worker + DB + storage), backups, monitoring
- [ ] Docs: setup, deploy, integrations, webhooks, backup/restore
- [ ] Credentials list + final implementation report (completed / tested / simulated / awaiting config)
