# User Journeys & Route Map

**Status:** Phase 1 · 2026-10-15

Every journey here maps to an E2E test in Phase 7 (`tests/e2e/jNN-*.spec.ts`).

---

## 1. Core journeys

| # | Journey | Steps | Routes | Key server checks |
|---|---------|-------|--------|-------------------|
| J01 | Visitor discovers a destination and enquires | Home → filter destinations → destination detail → "Plan this trip" → enquiry form → reference shown + email | `/`, `/destinations`, `/destinations/[slug]`, `/contact?destination=` | Zod validation, rate limit, idempotency key, honeypot |
| J02 | Visitor configures a package booking | Package detail → pick departure, room config, add-ons → live server quote → traveller details → review | `/packages/[slug]`, `/packages/[slug]/book` | Quote computed server-side; departure capacity; quote expiry |
| J03 | Customer signs up and views a booking | Sign up → verify email → bookings list → booking detail | `/sign-up`, `/verify-email`, `/account/bookings/[ref]` | Ownership check on booking |
| J04 | Guest retrieves a booking | Lookup form (reference + email) → code sent to email on file → enter code → read-only booking view | `/booking/lookup` | Reference alone shows nothing; code single-use, 10-min expiry, rate limited |
| J05 | Customer completes a test payment | Booking → Pay deposit → Paystack (test) → return → "verifying" → confirmed by webhook | `/account/bookings/[ref]/pay`, `/api/webhooks/paystack` | Server verify; never trust redirect |
| J06 | Duplicate webhook doesn't duplicate a transaction | Same event delivered twice → one transaction, one ledger entry, one email | `/api/webhooks/paystack` | `UNIQUE(provider, event_id)`, `UNIQUE(provider, provider_reference, kind)`, notification dedup key |
| J07 | Agent confirms an enquiry-based booking | Admin enquiry → convert to custom booking → add items → mark supplier confirmed → request payment | `/admin/enquiries/[ref]`, `/admin/bookings/[ref]` | `enquiry.manage`, `booking.update_status`, valid transitions |
| J08 | Customer creates a group trip and invites people | New group → set dates/budget → invite by email + link | `/group-trips/new`, `/account/groups/[id]` | Invite tokens hashed, expiring |
| J09 | Participants vote on a destination | Accept invite → open poll → vote → results after deadline | `/invite/[token]`, `/account/groups/[id]/polls/[pollId]` | Membership check; one vote per member; closed polls reject votes |
| J10 | Customer creates and saves a budget | Budget calculator → adjust inputs → see category totals + sources → save → share link | `/budget`, `/account/plans` | Formula versioned; every line labelled by source |
| J11 | Customer generates and edits an AI proposal | Planner intake → proposal → edit day → save → send to consultant | `/plan`, `/account/plans/[ref]` | Rate limit; schema validation; no sensitive data sent; handoff consent |
| J12 | Customer uploads a private document | Visa case → checklist item → upload passport → shows "uploaded" | `/account/visa/[ref]` | MIME sniff, size limit, private bucket, access log |
| J13 | Unauthorized user blocked from that document | Other customer / non-visa staff requests download → 404/403, attempt logged | `/api/documents/[id]/download` | Ownership or `document.read_private`; no URL leakage |
| J14 | Visa officer updates case → notification | Officer changes status with customer note → customer gets email + in-app | `/admin/visa/[ref]` | `visa.manage`; history row; dedup |
| J15 | Admin creates and publishes a package | New package → itinerary days → options → prices → departures → preview → publish | `/admin/packages/new`, `/admin/packages/[id]` | `catalogue.edit`/`publish`; validation blocks publishing incomplete packages |
| J16 | Unauthorized staff blocked from finance | Booking agent tries refund → forbidden, audited | `/admin/finance/refunds` | `finance.refund` |
| J17 | Cancellation follows policy | Customer requests cancel → penalty shown from policy snapshot → staff approves → refund flow | `/account/bookings/[ref]/cancel`, `/admin/bookings/[ref]` | Policy engine; refund ≤ paid |
| J18 | Failed integration → safe fallback | Flight search with provider down/unconfigured → honest message + enquiry form prefilled | `/flights` | `IntegrationNotConfiguredError` / timeout handling; nothing fabricated |

## 2. Route map

### Public — `app/(public)`
| Route | Rendering | Notes |
|-------|-----------|-------|
| `/` | ISR | CMS-driven sections |
| `/destinations` | SSR (search params) | Filters in query string; `noindex` for multi-filter combos, canonical to base |
| `/destinations/[slug]` | ISR | JSON-LD `TouristDestination` |
| `/collections/[slug]` | ISR | Curated (honeymoon, family, weekend escapes…) |
| `/packages` | SSR | Filters |
| `/packages/[slug]` | ISR | JSON-LD `TouristTrip` + `Offer` only when price is real |
| `/packages/[slug]/book` | Dynamic, noindex | Multi-step booking |
| `/flights`, `/hotels` | Dynamic | Adapter search or enquiry fallback |
| `/plan` | Dynamic | AI planner |
| `/budget` | Static shell + client calc via server action | |
| `/budget/[ref]` | Dynamic, noindex | Shared budget (token) |
| `/group-trips` | Static | Feature landing |
| `/group-trips/new` | Dynamic (auth) | |
| `/invite/[token]` | Dynamic, noindex | |
| `/visa` | ISR | Readiness tool entry |
| `/guides`, `/guides/[slug]` | ISR | Articles |
| `/consultations`, `/consultations/book` | Dynamic | Scheduling |
| `/contact` | Static + server action | |
| `/booking/lookup` | Dynamic, noindex | Guest retrieval |
| `/legal/[slug]` | ISR | Terms, privacy, cookies, cancellation |
| `/sitemap.xml`, `/robots.txt` | Generated | |

### Auth — `app/(auth)`
`/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/two-factor`

### Account — `app/(account)/account` (auth required, noindex)
| Route | Purpose |
|-------|---------|
| `/account` | Overview: next trip, tasks, balances, notifications |
| `/account/bookings`, `/[ref]`, `/[ref]/pay`, `/[ref]/cancel` | Bookings |
| `/account/trips/[ref]` | Travel companion |
| `/account/payments` | Invoices, receipts, balances |
| `/account/groups`, `/[id]` | Group trips |
| `/account/visa`, `/[ref]` | Visa cases + checklist |
| `/account/documents` | All private documents |
| `/account/saved` | Saved destinations/packages |
| `/account/plans`, `/[ref]` | Budgets + AI proposals |
| `/account/support`, `/[ref]` | Tickets |
| `/account/notifications` | In-app inbox |
| `/account/settings` | Profile, preferences, consent, security, delete account |

### Admin — `app/(admin)/admin` (staff + permission per page, noindex)
| Route | Permission |
|-------|-----------|
| `/admin` | any staff (widgets filtered by permission) |
| `/admin/bookings`, `/[ref]` | `booking.read` |
| `/admin/enquiries`, `/[ref]` | `enquiry.manage` |
| `/admin/customers`, `/[id]` | `customer.read` |
| `/admin/consultations` | `consultation.manage` |
| `/admin/support`, `/[ref]` | `support.manage` |
| `/admin/destinations`, `/[id]` | `catalogue.edit` |
| `/admin/packages`, `/new`, `/[id]` | `catalogue.edit` |
| `/admin/departures` | `catalogue.edit` |
| `/admin/pricing` | `pricing.edit` |
| `/admin/suppliers`, `/[id]` | `supplier.manage` |
| `/admin/finance` (+ `/transactions`, `/invoices`, `/refunds`, `/reconciliation`, `/reports`) | `finance.read` (+ action perms) |
| `/admin/visa`, `/[ref]` | `visa.manage` |
| `/admin/groups` | `booking.read` |
| `/admin/content` (+ `/articles`, `/pages`, `/homepage`, `/navigation`, `/faqs`, `/redirects`) | `content.manage` |
| `/admin/notifications` (templates, delivery log) | `settings.manage` |
| `/admin/analytics` | `analytics.read` |
| `/admin/staff` | `staff.manage` |
| `/admin/audit` | `audit.read` |
| `/admin/settings` | `settings.manage` |

### API — `app/api`
| Route | Auth |
|-------|------|
| `POST /api/webhooks/paystack` | HMAC signature |
| `POST /api/webhooks/email` | Provider signature |
| `GET /api/documents/[id]/download` | Session + permission → 302 to 60s signed URL |
| `POST /api/cron/[job]` | `CRON_SECRET` header (fallback when pg-boss scheduler not used) |
| `/api/auth/*` | Better Auth |

## 3. Navigation

**Header:** Destinations · Packages · Plan a trip (AI planner, Budget calculator, Group trips, Visa readiness) · Guides · Contact. Actions on the right: Search, Sign in / Account, "Talk to a consultant" (gold button).

**Mobile:** sheet menu with the same groups and a sticky bottom "Enquire" CTA on destination/package pages.

**Footer:** Company (About, Contact, Careers placeholder), Travel (Destinations, Packages, Guides), Tools (Planner, Budget, Visa, Groups), Help (FAQs, Booking lookup, Support), Legal (Terms, Privacy, Cookies, Cancellation policy), contact details from settings, social links from settings.

**Account sidebar:** Overview · Bookings · Trips · Payments · Groups · Visa · Documents · Saved · Plans · Support · Settings.

**Admin sidebar** (filtered by permission): Overview · Bookings · Enquiries · Customers · Consultations · Support | Catalogue (Destinations, Packages, Departures, Pricing, Suppliers) | Finance | Visa | Groups | Content | Analytics | Settings (Staff, Notifications, Audit, Business settings).
