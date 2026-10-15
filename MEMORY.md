# Project Memory

Running record of decisions, context and state so any contributor (human or AI) can pick up where the last one stopped. Newest entries at the top of each section.

## Current state

- **Phase:** 3 mostly complete on branch `phase-3/public-experience` (stacked on `phase-2/foundation`, PR #2 still open). Remaining in Phase 3: consultations, guides/CMS, legal pages, Playwright E2E.
- **Repo:** https://github.com/Anuoluwa-samuel/Travel-Agency- (was empty at start; fresh build)
- **Local path:** `~/Downloads/travel agency`
- **Default branch:** `main`

## Fixed requirements from the owner

- Brand name: **ORBIS**.
- Primary colours: Deep Navy `#0B2545`, Champagne Gold `#D6A85C`, Cloud White `#F7F8FA`.
- `.claude/` must never be committed or pushed (in `.gitignore`).
- Planning docs (PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY) were created before Phase 1.
- The master build brief is the source of truth for scope. These docs condense it.

## Key decisions

| Date | Decision | Ref |
|------|----------|-----|
| 2026-10-15 | Next.js **16.4** with Cache Components: session reads must sit inside `<Suspense>`; account/admin layouts set `instant = false` so auth is re-checked every navigation | ARCHITECTURE §1 |
| 2026-10-15 | `APP_ENV` (development/test/staging/production) controls deployment strictness, separate from `NODE_ENV` | README |
| 2026-10-15 | Packages pinned to versions ≥ 1 day old (pnpm `minimumReleaseAge` policy) | package.json |
| 2026-10-15 | `cn` helper comes from shadcn's own `cn` package (replaces clsx + tailwind-merge) | components.json |
| 2026-10-15 | Better Auth field names drive `users`/`sessions`/`accounts`/`verifications`/`two_factors`; `users.email_verified` is a boolean (not a timestamp as first drafted) | data-model §1 |
| 2026-10-15 | Customers and signed-out visitors get a 404 on `/admin`; privileged staff without 2FA are sent to `/account/security?required=2fa` | RULES §5 |
| 2026-10-15 | Catalogue reads live in `services/catalogue/queries.ts` with `use cache` + `cacheTag("catalogue")`; all date/price logic resolved there so pages never read the clock or compute prices | Phase 3 |
| 2026-10-15 | `generateStaticParams` must return ≥1 param under Cache Components; `staticSlugParams()` falls back to a `__none` placeholder (404) when nothing is published | Phase 3 |
| 2026-10-15 | Public package payload exposes only coarse availability (open/limited/closed), never seat counts or raw price rules | Phase 3 |
| 2026-10-15 | Destination tiles are typographic (no stock photos) until licensed photography is uploaded | DESIGN §6 |
| 2026-10-15 | Enquiry idempotency: client UUID written on submit (React 19 resets uncontrolled fields after an action), server falls back to a content hash per 10-minute window | Phase 3 |
| 2026-10-15 | Streamed `notFound()` returns HTTP 200 with `noindex` (Partial Prerendering); acceptable soft-404 | Phase 3 |
| 2026-10-15 | Typed routes off for now: nav config holds hrefs for unbuilt pages behind `live: false` | config/navigation.ts |
| 2026-10-15 | Next.js App Router + TS + Tailwind + shadcn/ui | ARCHITECTURE §1 |
| 2026-10-15 | PostgreSQL + Drizzle; pg-boss for jobs (no Redis in v1) | ADR-002, ADR-003 |
| 2026-10-15 | Money in integer minor units, append-only ledger | ADR-004 |
| 2026-10-15 | All external services behind capability adapters; unconfigured → honest fallback | ADR-005 |
| 2026-10-15 | Better Auth, staff 2FA for finance/admin | ADR-006 |
| 2026-10-15 | Paystack first payment provider; NGN base currency; Africa/Lagos timezone | PRD §11 |
| 2026-10-15 | Brand name is **ORBIS** (owner-confirmed; still editable via settings) | DESIGN §9 |
| 2026-10-15 | Gold `#D6A85C` is not used for text on light backgrounds (contrast 2.1:1); use gold-700 `#8C6A2E` | DESIGN §1 |

## Assumptions to confirm with the owner

- Real agency name, logo, domain, address, licences/accreditations
- Paystack merchant account (NGN/USD?) and settlement currency
- Which flight/hotel suppliers (if any) have contracts/API access
- Deposit/instalment defaults and cancellation policy wording
- Email sending domain; WhatsApp Business number
- Hosting preference (Vercel + Neon vs other)

## Environment notes

- Node v24, pnpm 12, Docker locally. Postgres runs in Docker on **port 5544** (5433 is used by another project on this machine).
- Dev DB `orbis`, test DB `orbis_test` (wiped by every integration run).
- Demo account password lives only in `.env.local` as `SEED_DEMO_PASSWORD`.
- No DB passwords in the repo (GitGuardian flagged the old compose file): local Docker and the CI service use trust auth bound to localhost. The original local volume was created with a password, so the existing `.env.local` URL still includes one; fresh setups don't need it.
- The folder path contains a space: use `pathToFileURL` / `fileURLToPath` rather than `URL.pathname` in scripts.

## Integration status

| Integration | Status |
|-------------|--------|
| Paystack | not started |
| Resend (email) | adapter built; console fallback in dev; not yet configured |
| Anthropic Claude (AI planner) | not started |
| S3/R2 storage | not started |
| Flight / hotel suppliers | not started; no credentials |
| WhatsApp Cloud API | not started; optional |
| Weather / flight status / advisories | not started |

## Phase log

### Phase 3 (part 1) — 2026-10-15
- Catalogue service (published-only), from-price calculator, filters parsed from URL params.
- Pages: homepage, /destinations (+ detail), /packages (+ detail), /contact, /flights, /hotels, sitemap.
- Enquiries table + service + server action with rate limiting, honeypot and idempotency; acknowledgement email via provider adapter.
- CI now seeds fictional data before the build.
- Tests: 105 pass. Browser: filters, package page, enquiry error → fix → success (client key reused), mobile 375px no horizontal scroll, filters collapse on phones.
- Fixed during testing: package page read the clock during prerender; enquiry key cleared by React form reset; confirmation not scrolled into view; cramped two-column contact layout.

### Phase 2 — 2026-10-15
- Scaffolded Next.js 16.4 + Tailwind 4 + shadcn/ui; ORBIS tokens, fonts, logo, core and feedback components.
- Drizzle schema for identity, catalogue (destinations, packages, itineraries, options, departures, price rules, fees, policies, payment plans) and platform; DB-level guards (capacity, non-negative prices, one hero image, case-insensitive email, append-only audit log).
- Better Auth with email verification, reset, change password, TOTP 2FA, DB rate limits; RBAC helpers; Proxy and security headers.
- Public, auth, account and admin shells; seed with fictional data and a demo account per role.
- Tests: 57 unit + 16 integration pass; lint, typecheck and production build pass. Browser check: sign-up → email link → account → 2FA enrol → sign-in with 2FA prompt; customer gets 404 on /admin; no horizontal scroll at 375px.
- Added GitHub Actions CI (`.github/workflows/ci.yml`), verified by running each step in a clean copy with no `.env.local`. `pnpm typecheck` now runs `next typegen` first.
- Deferred (tracked in TASKS): Playwright config, DatePicker/TravellerPicker/DataTable/Timeline, request IDs + audit service, idempotency helper, nonce-based CSP (Phase 7).

### Phase 1 — 2026-10-15
- Added `docs/data-model.md` (110 tables across 14 domains, conventions, indexes, retention), `docs/state-machines.md`, `docs/journeys.md` (J01–J18 + route map + navigation), `docs/integrations.md`, `docs/assumptions.md`.
- Decisions: UUIDv7 PKs + random base32 public references; append-only enforced by DB triggers; passport/DOB encrypted at app level; consultation overlap blocked by a Postgres exclusion constraint; visa "completed" means service complete, not visa granted.
- Tests: none (documentation phase).

### Phase 0 — 2026-10-15
- Created local folder, cloned empty repo, added `.gitignore` (excludes `.claude/`).
- Wrote the six planning docs.
- Tests: none yet (no code).
