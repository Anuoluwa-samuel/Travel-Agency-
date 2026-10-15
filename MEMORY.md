# Project Memory

Running record of decisions, context and state so any contributor (human or AI) can pick up where the last one stopped. Newest entries at the top of each section.

## Current state

- **Phase:** 0 complete (planning docs). Next: Phase 1, discovery & architecture.
- **Repo:** https://github.com/Anuoluwa-samuel/Travel-Agency- (was empty at start; fresh build)
- **Local path:** `~/Downloads/travel agency`
- **Default branch:** `main`

## Fixed requirements from the owner

- Primary colours: Deep Navy `#0B2545`, Champagne Gold `#D6A85C`, Cloud White `#F7F8FA`.
- `.claude/` must never be committed or pushed (in `.gitignore`).
- Planning docs (PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY) were created before Phase 1.
- The master build brief is the source of truth for scope. These docs condense it.

## Key decisions

| Date | Decision | Ref |
|------|----------|-----|
| 2026-10-15 | Next.js App Router + TS + Tailwind + shadcn/ui | ARCHITECTURE §1 |
| 2026-10-15 | PostgreSQL + Drizzle; pg-boss for jobs (no Redis in v1) | ADR-002, ADR-003 |
| 2026-10-15 | Money in integer minor units, append-only ledger | ADR-004 |
| 2026-10-15 | All external services behind capability adapters; unconfigured → honest fallback | ADR-005 |
| 2026-10-15 | Better Auth, staff 2FA for finance/admin | ADR-006 |
| 2026-10-15 | Paystack first payment provider; NGN base currency; Africa/Lagos timezone | PRD §11 |
| 2026-10-15 | Placeholder brand name "Voyagr" (replaceable via settings) | DESIGN §9 |
| 2026-10-15 | Gold `#D6A85C` is not used for text on light backgrounds (contrast 2.1:1); use gold-700 `#8C6A2E` | DESIGN §1 |

## Assumptions to confirm with the owner

- Real agency name, logo, domain, address, licences/accreditations
- Paystack merchant account (NGN/USD?) and settlement currency
- Which flight/hotel suppliers (if any) have contracts/API access
- Deposit/instalment defaults and cancellation policy wording
- Email sending domain; WhatsApp Business number
- Hosting preference (Vercel + Neon vs other)

## Environment notes

- Node v24, pnpm 12 available locally. PostgreSQL not installed locally → use Docker Compose.

## Integration status

| Integration | Status |
|-------------|--------|
| Paystack | not started |
| Resend (email) | not started |
| Anthropic Claude (AI planner) | not started |
| S3/R2 storage | not started |
| Flight / hotel suppliers | not started; no credentials |
| WhatsApp Cloud API | not started; optional |
| Weather / flight status / advisories | not started |

## Phase log

### Phase 0 — 2026-10-15
- Created local folder, cloned empty repo, added `.gitignore` (excludes `.claude/`).
- Wrote the six planning docs.
- Tests: none yet (no code).
