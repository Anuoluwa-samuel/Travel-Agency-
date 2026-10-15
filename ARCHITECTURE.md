# Architecture

**Status:** Draft v0.1 · 2026-10-15 · Fresh build (repository was empty)

---

## 1. Stack decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js (App Router) + TypeScript (strict)** | SSR/SSG for SEO, server actions + route handlers, one deployable |
| UI | **React Server Components**, **Tailwind CSS v4**, **shadcn/ui** (Radix primitives) | Accessible primitives, owned component code, token-driven theming |
| Forms | **React Hook Form + Zod** | Same Zod schemas validate client and server |
| Database | **PostgreSQL 16** | Relational integrity, transactions, constraints for money & bookings |
| ORM | **Drizzle ORM + drizzle-kit migrations** | Typed SQL, explicit migrations, no runtime engine |
| Auth | **Better Auth** (email/password, magic link, OTP, 2FA plugin) with DB sessions | Self-hosted, Drizzle adapter, MFA for staff |
| Jobs | **pg-boss** (Postgres-backed queue) | No extra infra in v1; retries, scheduling, singleton keys |
| Cache / rate limit | Postgres-backed limiter in v1 → **Redis (Upstash)** adapter when needed | Avoid premature infra |
| Object storage | **S3-compatible** (Cloudflare R2 / AWS S3); local disk adapter for dev | Private bucket + signed URLs for documents |
| Payments | **Paystack** adapter behind `PaymentProvider` | Nigerian market, NGN + USD |
| Email | **Resend** adapter behind `EmailProvider`; console adapter in dev | |
| AI | **Anthropic Claude** behind `AiProvider`; structured output validated by Zod | Replaceable |
| Testing | **Vitest** (unit/integration), **Playwright** (E2E), Testcontainers or dedicated test DB | |
| Observability | Pino structured logs, Sentry (optional), request IDs | |
| Package manager | **pnpm** | |
| Hosting | Vercel (web) or any Node host + managed Postgres (Neon/Supabase/RDS) + worker process for pg-boss | |

## 2. High-level shape

```
┌──────────────────────────── Next.js app ────────────────────────────┐
│  app/(public)   app/(account)   app/(admin)   app/api/*  (webhooks)  │
│        │               │              │              │               │
│        └──── server actions / route handlers (thin) ─┘               │
│                              │                                       │
│                    src/server/services/*   ← business rules          │
│                              │                                       │
│    src/server/db (Drizzle)   src/server/integrations/* (adapters)    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
     PostgreSQL ◄── pg-boss worker (notifications, reminders, holds, reconciliation)
     S3 / R2 (private docs, public media)   Paystack · Resend · Claude · Supplier APIs
```

UI never enforces pricing, permissions, booking or payment rules. It calls services; services enforce.

## 3. Directory layout

```
src/
  app/
    (public)/            homepage, destinations, packages, planner, budget, visa, guides, contact
    (auth)/              sign-in, sign-up, verify, reset
    (account)/account/   customer portal
    (admin)/admin/       operations workspace
    api/                 webhooks (payments, email), cron triggers, signed downloads
  components/
    ui/                  shadcn primitives (themed)
    brand/               logo, brand config consumers
    public/ account/ admin/  feature components
  server/
    db/
      schema/            one file per domain
      migrations/
      seed/
    services/            booking, pricing, quote, payment, ledger, group, visa, budget, ai, cms, notification …
    auth/                session helpers, permission checks
    integrations/
      payments/          paystack.ts, mock.ts, types.ts
      suppliers/         flights/, hotels/, transfers/, insurance/ (types + mock + real)
      email/ whatsapp/ sms/ ai/ weather/ fx/ storage/
    jobs/                pg-boss handlers
    lib/                 money.ts, refs.ts, idempotency.ts, errors.ts, logger.ts
  lib/                   client-safe utils, zod schemas shared with forms
  config/                env.ts (validated at boot), brand.ts
tests/
  unit/ integration/ e2e/
```

## 4. Domain boundaries

| Domain | Owns | Key invariants |
|--------|------|----------------|
| **Identity & Access** | users, sessions, roles, permissions, staff/customer profiles | Every server op checks permission + resource ownership |
| **Catalogue** | destinations, media, categories, packages, itinerary days/activities, options, departures, price rules | Only `published` items are public; prices come from price rules |
| **Inventory & Suppliers** | suppliers, supplier offers, inventory/availability, holds | Distinguish manual vs supplier-confirmed; no overselling where controlled |
| **Quoting** | quotes, quote lines, exchange-rate snapshots | Server-calculated, expiring, immutable once accepted |
| **Booking** | bookings, travellers, items, status history, cancellation requests | State machine per booking type; transitions validated + recorded |
| **Payments & Finance** | invoices, payment schedules, payment attempts, transactions, refunds, ledger entries, reconciliation | Integer minor units; append-only ledger; webhook idempotency |
| **CRM & Support** | enquiries, enquiry messages, interactions, consultations, support tickets | Assignments, SLAs, history preserved |
| **Group Planning** | group trips, memberships, invitations, proposals, polls, votes, expenses, contributions, checklists | Votes never create bookings; private finances hidden from other members |
| **Visa & Documents** | visa cases, checklist items, private documents, document versions, access log | Private storage, signed short-lived URLs, every access logged |
| **Planning Tools** | budgets, AI sessions, saved proposals, trip plans | Every cost line labelled by source |
| **Companion** | trip dashboard aggregation, external data snapshots | Source + last-updated on time-sensitive data |
| **Content** | CMS pages, guides, FAQs, banners, SEO metadata, redirects | Draft → review → scheduled → published → archived |
| **Notifications** | templates, notifications, delivery attempts, preferences | Dedup keys; consent respected |
| **Platform** | audit log, settings, feature flags | Sensitive actions audited |

## 5. Booking state machine (summary)

```
draft → request_submitted → awaiting_supplier → awaiting_payment → partially_paid → confirmed → (ticketed) → in_progress → completed
                    ↘ failed/expired      ↘ cancelled          confirmed → cancellation_requested → cancelled → refund_pending → refunded
```

Allowed transitions are defined per booking type (`package`, `flight`, `hotel`, `custom`, `service`) in `services/booking/transitions.ts`, enforced in one `transition()` function inside a DB transaction that writes `booking_status_history` (from, to, actor, note, timestamp).

## 6. Money model

- `amount_minor BIGINT` + `currency CHAR(3)` everywhere. No floats.
- `money.ts` provides add/sub/multiply-by-ratio with banker's rounding documented per currency exponent.
- Display conversion uses an `exchange_rate_snapshot` (rate, source, fetched_at). Converted display amounts are labelled "indicative".
- Ledger: `ledger_entries` are append-only (DB trigger blocks UPDATE/DELETE). Corrections are reversing entries.
- Payments: `payment_attempts` (one per checkout init) → `transactions` (one per verified provider event, unique on `(provider, provider_reference)`).

## 7. Payment flow

1. Server creates invoice/payment attempt with internal reference + idempotency key.
2. Client redirected to Paystack.
3. Return URL shows **"verifying…"** — never success from redirect alone.
4. Webhook (HMAC SHA-512 verified) and/or server `verify` call → upsert transaction (unique constraint makes duplicates a no-op) → ledger entry → booking balance recalculated → notification job (dedup key).

## 8. Authorization

- RBAC: roles → permissions (`booking.read`, `booking.update_status`, `finance.refund`, `document.read_private`, …).
- Resource-level checks: customers only see their own records; group members see group data per role; staff scoped by assignment where configured.
- Helpers: `requireUser()`, `requireStaff(permission)`, `assertCanAccess(resource, user)`. Every service entry point calls one.
- Permission matrix lives in `src/server/auth/permissions.ts` and is documented in `RULES.md`.

## 9. Integrations (adapter pattern)

Each adapter exports a `capabilities` object; callers check before invoking. Interfaces:

| Port | v1 adapters |
|------|-------------|
| `PaymentProvider` | paystack, mock |
| `FlightProvider` | mock (labelled simulated); Duffel planned |
| `HotelProvider` | mock; Hotelbeds/Amadeus planned |
| `EmailProvider` | resend, console |
| `MessagingProvider` | whatsapp-cloud (optional), none |
| `AiProvider` | anthropic, mock |
| `StorageProvider` | s3/r2, local-disk (dev) |
| `FxProvider` | configured source, static (dev) |
| `WeatherProvider` / `FlightStatusProvider` / `AdvisoryProvider` | planned, with `unavailable` fallback |

Unconfigured providers resolve to an `unconfigured` adapter that throws `IntegrationNotConfiguredError`; the UI shows an honest fallback (usually "enquire instead").

## 10. Route map (initial)

**Public:** `/`, `/destinations`, `/destinations/[slug]`, `/packages`, `/packages/[slug]`, `/packages/[slug]/book`, `/flights`, `/hotels`, `/plan` (AI planner), `/budget`, `/group-trips`, `/visa`, `/guides`, `/guides/[slug]`, `/consultations`, `/contact`, `/booking/lookup`, `/legal/[slug]`

**Auth:** `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`

**Account:** `/account`, `/account/bookings`, `/account/bookings/[ref]`, `/account/trips/[id]` (companion), `/account/payments`, `/account/groups`, `/account/groups/[id]`, `/account/visa`, `/account/visa/[id]`, `/account/documents`, `/account/saved`, `/account/plans`, `/account/support`, `/account/settings`

**Admin:** `/admin`, `/admin/bookings`, `/admin/enquiries`, `/admin/customers`, `/admin/packages`, `/admin/destinations`, `/admin/departures`, `/admin/suppliers`, `/admin/finance/{transactions,refunds,invoices,reconciliation,reports}`, `/admin/visa`, `/admin/consultations`, `/admin/support`, `/admin/content`, `/admin/notifications`, `/admin/analytics`, `/admin/staff`, `/admin/audit`, `/admin/settings`

**API:** `/api/webhooks/paystack`, `/api/webhooks/email`, `/api/documents/[id]/download` (signed redirect), `/api/cron/*` (secret-protected)

## 11. Security baseline

CSP + secure headers via middleware; rate limits on auth, enquiry, AI, lookup endpoints; Zod on every input; IDs are UUIDv7, public references are random base32 (e.g. `TRV-7K3M-Q9XP`); uploads validated by MIME sniffing + size limit, stored privately, optional malware scan hook; PII-redacting logger; secrets only in server env (validated by `env.ts`, never `NEXT_PUBLIC_*`).

## 12. Architectural decision log

| ID | Decision | Date |
|----|----------|------|
| ADR-001 | Single Next.js monolith with service layer; no microservices | 2026-10-15 |
| ADR-002 | Drizzle over Prisma for explicit SQL + lightweight runtime | 2026-10-15 |
| ADR-003 | pg-boss for jobs to avoid Redis in v1 | 2026-10-15 |
| ADR-004 | Money as integer minor units + append-only ledger | 2026-10-15 |
| ADR-005 | All external services behind capability-declaring adapters | 2026-10-15 |
| ADR-006 | Better Auth with DB sessions; TOTP 2FA required for staff with finance/admin permissions | 2026-10-15 |
