# Product Requirements Document

**Product:** ORBIS — International Travel Agency & Smart Travel Platform (brand settings remain configurable)
**Status:** Draft v0.1 · 2026-10-15
**Primary market:** Nigeria (NGN base), serving international customers (USD, GBP, EUR display)

---

## 1. Summary

A full travel business platform, more than a marketing site. It combines a premium public website, a destination and package marketplace, a hybrid booking and enquiry engine, a customer trip portal, smart planning tools (AI planner, budget calculator, group planning, visa readiness, travel companion), and a complete agency operations back office (CRM, bookings, finance, visa cases, content, staff, analytics).

## 2. Goals

| # | Goal | Measured by |
|---|------|-------------|
| G1 | Turn browsing into qualified enquiries and bookings | Enquiry-to-booking conversion, package detail → checkout rate |
| G2 | Be transparent about price, availability, terms and status | Zero "fake success" states, every price shows its source and validity |
| G3 | Let a small agency team run operations from one workspace | Bookings, payments, visa cases and enquiries handled without spreadsheets |
| G4 | Keep customers engaged after they book | Portal logins per trip, document completion before deadlines |
| G5 | Protect customer data and money | No IDOR or document leaks, payments reconciled and idempotent |

## 3. Non-goals (for v1)

- Acting as an airline consolidator / IATA ticketing system in-house.
- Submitting visa applications to governments automatically.
- Native mobile apps (responsive web + PWA-ready only).
- Multiple separate microservices or databases.
- Promising visa approval, guaranteed entry, or guaranteed appointment slots.

## 4. Users and personas

| Persona | Needs |
|---------|-------|
| **Visitor** | Discover destinations, compare packages, estimate costs, enquire without friction |
| **Customer** | Book, pay (deposits/instalments), track trips, upload documents, contact consultant |
| **Guest booker** | Retrieve a booking securely without creating an account |
| **Group organizer** | Plan a trip with friends/family: invite, vote, split costs, track who paid |
| **Group participant** | Vote, see their own share, register, pay their portion |
| **Travel consultant / booking agent** | Work enquiries, build quotes, confirm supplier arrangements |
| **Visa case officer** | Manage document checklists, case status, deadlines |
| **Finance officer** | Payments, refunds, reconciliation, reports |
| **Content editor** | Destinations, packages, guides, SEO, homepage |
| **Operations manager / Super admin** | Oversight, staff, roles, settings, audit |

## 5. Operating model: hybrid booking

| Mode | When | Outcome |
|------|------|---------|
| **Instant book** | A connected supplier gives reliable availability + price + booking API | Booking created → payment → confirmed by supplier |
| **Request to book** | Package/departure needs manual supplier confirmation | Booking request → staff confirms → payment requested |
| **Enquiry-led** | Custom itinerary, consultation, visa help, special arrangements | Enquiry → consultant → quote → booking |

An enquiry acknowledgement is **never** shown as a confirmed reservation.

## 6. Functional scope

### 6.1 Public experience
- Homepage, destination discovery (search, filters, sort, pagination, curated collections), destination detail pages.
- Package catalogue and detail (structured itinerary days, inclusions/exclusions, departures, room options, add-ons, terms, payment schedule, FAQs).
- Flights and hotel search (via supplier adapters; enquiry fallback when not configured).
- Trip budget calculator, AI travel planner, group trip planning, visa readiness info.
- Travel guides/articles, consultation booking, contact/support, auth.

### 6.2 Booking & payments
- Server-side quote calculation from price rules; quotes have expiry and lock accepted price/terms.
- Booking state machine per booking type with full status history.
- Non-guessable references, idempotency keys, duplicate-submission protection, inventory holds with expiry.
- Payment provider adapter (Paystack first), server verification + signed webhooks, deposits, instalments, receipts, invoices, refunds, append-only ledger, reconciliation.
- Guest booking retrieval via one-time code / magic link to the verified contact.

### 6.3 Customer workspace
Profile & preferences, bookings, payments & balances, saved items, trips (upcoming/active), group trips, visa cases, secure documents, notifications, support tickets, assigned consultant contact.

### 6.4 Smart travel features
- **Group planning:** roles (organizer, co-organizer, participant, staff), invitations with expiry/revocation, destination proposals, polls with deadlines, shared/individual expenses, cost scenarios, checklist, room preferences, activity log, export.
- **Visa readiness:** guided intake → checklist (only where reliable data exists) → secure uploads → optional agency-managed case with configurable statuses. Shows source + "last checked" date for guidance.
- **Budget calculator:** full trip cost by category, target budget comparison, lower-cost alternatives, save/share/export/convert to enquiry. Every line labels its source: *supplier price*, *configured estimate*, or *AI estimate*.
- **AI planner:** short intake, structured (schema-validated) proposals with day-by-day itinerary, budget tiers, uncertainties, next steps; human handoff with consent. AI never invents live prices, inventory, confirmations or visa rules.
- **Travel companion:** trip dashboard with confirmed itinerary, references, contacts, documents, checklists, weather/flight status/advisories via adapters with source + last-updated, safe fallbacks.

### 6.5 Agency operations
Overview dashboard, booking management, enquiry CRM, package & destination CMS, departures & inventory, suppliers, finance (transactions, reconciliation, refunds, invoices, reports), visa case queues, consultation scheduling, support, staff & roles, content management, notifications/templates, analytics, audit logs, business settings.

### 6.6 Notifications
Centralized service: email + in-app (WhatsApp/SMS optional adapters). Template-driven, background jobs, retries, dedup, delivery tracking, consent-aware.

## 7. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Security | Server-side authz on every operation, resource-level checks, rate limiting, CSRF, secure headers, private storage + signed URLs, audit log, MFA for staff |
| Privacy | NDPA 2023 (Nigeria) and GDPR where applicable — data minimization, consent, retention policy. No compliance claims without legal review |
| Money | Integer minor units, explicit currency on every amount, append-only ledger, auditable rounding |
| Accessibility | WCAG 2.2 AA target |
| Performance | Good Core Web Vitals on public pages; SSG/ISR for destinations/packages |
| SEO | Canonicals, sitemap, robots, OG, structured data where accurate, slug redirects |
| Reliability | Integrations fail safely with honest fallbacks; jobs retry idempotently |
| i18n readiness | Multi-currency, timezone-aware display, locale-ready strings, configurable tax |

## 8. Integrity rules (product-level)

1. Never fake a reservation, payment, search result, or visa submission.
2. Never trust browser-provided prices, permissions, payment or booking status.
3. Never fabricate reviews, ratings, awards, accreditation, partnerships or customer counts.
4. Mock adapters are dev/test only and visibly labelled as simulated.
5. Distinguish **confirmed** vs **proposed** vs **estimated** data everywhere it appears.

## 9. Brand (configurable)

- Name: **ORBIS**. Logo, domain, contact details: placeholders in settings until supplied.
- Primary palette: **Deep Navy `#0B2545`**, **Champagne Gold `#D6A85C`**, **Cloud White `#F7F8FA`**. See `DESIGN.md`.

## 10. Success criteria for launch

See "Definition of Done" in `RULES.md` and the launch checklist in `TASKS.md` (Phase 7).

## 11. Open questions / assumptions (configurable defaults)

| Topic | Default assumption |
|-------|--------------------|
| Agency legal name, address, licences | Placeholder; editable in settings; nothing invented |
| Base currency | NGN; display USD/GBP/EUR |
| Business timezone | Africa/Lagos |
| Payment provider | Paystack (adapter allows Flutterwave/Stripe later) |
| Flight/hotel supplier | None configured → enquiry fallback; Duffel / Amadeus / Hotelbeds adapters planned |
| AI provider | Anthropic Claude behind an `AiProvider` interface |
| Email | Resend (adapter) |
| WhatsApp | Meta WhatsApp Cloud API (adapter, optional) |
| Deposit policy | Configurable per package (default 30%) |
| Languages | English first; i18n-ready |
