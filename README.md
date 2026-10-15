# ORBIS — Travel Agency & Smart Travel Platform

ORBIS is a full travel business platform: a public site, packages and bookings, a customer portal, planning tools and an operations back office. It is built for an agency based in Nigeria that serves international customers.

> **Status:** Phase 2 (foundation) is done. See [TASKS.md](TASKS.md) for what is built and what comes next.

## Documentation

| Doc | What's in it |
|-----|--------------|
| [PRD.md](PRD.md) | Product scope, personas, booking model, non-functional requirements |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, domain boundaries, money model, payment flow, decision log |
| [RULES.md](RULES.md) | Engineering rules, permission matrix, definition of done |
| [DESIGN.md](DESIGN.md) | Colours, type, components, accessibility |
| [TASKS.md](TASKS.md) | Phases and checklists |
| [MEMORY.md](MEMORY.md) | Running decisions log and current state |
| [docs/](docs/) | Data model, state machines, journeys and routes, integrations, assumptions |

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · PostgreSQL 16 · Drizzle ORM · Better Auth · Zod · Vitest · Playwright · pnpm

## Prerequisites

- Node.js 24+
- pnpm 12+
- Docker (runs the local PostgreSQL)

## Local setup

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

Fill in `BETTER_AUTH_SECRET` (`openssl rand -base64 48`) and `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`) in `.env.local`. Leave the integration keys empty: unconfigured services fall back safely.

```bash
pnpm db:up
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Open http://localhost:3000.

### Demo accounts (local only)

`pnpm db:seed` creates one fictional account per staff role and one customer, all on the reserved `orbis.example` domain:

| Email | Role |
|-------|------|
| `super-admin@orbis.example` | Super administrator |
| `ops-manager@orbis.example` | Operations manager |
| `booking-agent@orbis.example` | Booking agent |
| `travel-consultant@orbis.example` | Travel consultant |
| `finance-officer@orbis.example` | Finance officer |
| `visa-officer@orbis.example` | Visa case officer |
| `content-editor@orbis.example` | Content editor |
| `support-agent@orbis.example` | Customer support agent |
| `traveller@orbis.example` | Customer |

They all share one password, taken from `SEED_DEMO_PASSWORD` in `.env.local`. If you don't set it, the seed generates a random one and writes it there. Privileged roles (super admin, ops manager, finance, visa) must turn on two-factor at `/account/security` before they can open `/admin`.

In development, emails (verification, password reset) are printed to the server log instead of being sent.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | Code quality |
| `pnpm test` | Unit and integration tests |
| `pnpm test:unit` | Pure logic tests (no database) |
| `pnpm test:integration` | Tests against `TEST_DATABASE_URL` (reset on every run) |
| `pnpm check` | Lint + typecheck + tests (run before every commit) |
| `pnpm db:up` / `pnpm db:down` | Start / stop local Postgres |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Load fictional development data (refuses to run in staging or production) |
| `pnpm db:studio` | Drizzle Studio |

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and on pushes to `main`. In order: install with the frozen lockfile, lint, typecheck, unit and integration tests, migrations on a clean database, then a production build.

- Postgres 16 runs as a service container. The job creates `orbis_test` for the integration suite.
- Auth and encryption secrets are generated fresh on every run. No real credentials are stored in GitHub.
- External integrations (payments, email, AI, storage) are left unconfigured on purpose, so CI checks the safe fallbacks and never calls a real service.

To reproduce CI locally, run `pnpm check` and then `pnpm build`.

## Environments

`APP_ENV` (`development` · `test` · `staging` · `production`) controls deployment strictness. It is separate from `NODE_ENV` because `next build` always sets `NODE_ENV=production`. With `APP_ENV=production` the app refuses to start without S3 storage and transactional email. The full list of variables is in [.env.example](.env.example), and integration setup is in [docs/integrations.md](docs/integrations.md).

## Project layout

```
src/
  app/(public)        Public site
  app/(auth)          Sign in, sign up, verification, reset, two-factor
  app/(account)       Customer workspace
  app/(admin)         Staff workspace (permission-filtered)
  app/api             Auth handler; webhooks and cron in later phases
  components/         ui/ (shadcn), brand/, layout/, feedback/, forms/, auth/, account/
  config/             Brand, navigation
  lib/                Client-safe: money, references, validation, uuid
  server/
    auth/             Better Auth, session + permission helpers, access checks
    db/               Drizzle schema, migrations, seed, client
    integrations/     Provider adapters (email so far)
    lib/              Logger (PII-redacting), errors
tests/unit · tests/integration
```
