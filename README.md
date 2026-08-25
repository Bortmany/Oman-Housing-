# Oman Property Intelligence

A bilingual (English/Arabic) real-estate analytics platform for Oman: a
market dashboard per neighborhood, investment calculators (rental yield,
mortgage, ROI), a public property marketplace, and admin/agency tools for
data entry and listing management.

**The core promise: honest data.** Every data-bearing figure (market stats,
property records, valuations) carries a provenance label — Verified,
Official statistic, User submitted, or AI estimated — plus a confidence
score, shown right next to the number. Estimates are never dressed up as
facts.

## What's built

- **Market dashboard** — average sale price, monthly rent, price per square
  metre, and gross rental yield for 11 Oman areas, with 24 months of
  history, trend charts, and neighborhood comparison.
- **Calculators** — rental yield, mortgage (conventional and Islamic
  financing), and full ROI (cash flow, break-even, long-term return). All
  money is OMR with its 3 decimal places (baisa).
- **Marketplace** — public property search and listing pages with
  provenance-labeled financials, favorites, and side-by-side comparison.
- **AI analyst** — a leashed question-and-answer card on each property page.
  It only ever sees stored, labeled figures; every answer's citations are
  checked in code, confidence is capped by the weakest figure cited, and the
  AI is skipped entirely when there isn't enough data to answer honestly.
- **Business tools** — buyer enquiries (spam-guarded), agency self-signup
  with an admin approval queue, and listing tiers (Free/Premium/Business).
- **Accounts & roles** — email/password login (Auth.js) with user, agency,
  and admin roles; every admin page and admin server action is role-checked.
- **Full bilingual/RTL support** — not an afterthought: every UI string and
  most data fields exist in English and Arabic, with a real right-to-left
  layout for Arabic.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) + TypeScript
- **[Prisma 6](https://www.prisma.io) + PostgreSQL** — schema in
  `prisma/schema.prisma`, no other ORM or query builder
- **[Auth.js v5](https://authjs.dev)** — email/password sessions, role-based
  access
- **[next-intl](https://next-intl.dev)** — English/Arabic i18n with RTL
- **[Tailwind CSS v4](https://tailwindcss.com)**
- **[MapLibre GL](https://maplibre.org)** — the interactive neighborhood map
- **[Recharts](https://recharts.org)** — trend and comparison charts
- **[Vitest](https://vitest.dev)** — unit tests

> This repo runs Next.js 16, which has breaking changes from earlier
> versions — see `AGENTS.md` if you're used to an older Next.js.

## Project layout

```
src/
  app/[locale]/       Pages (App Router, locale-prefixed: /en/..., /ar/...)
  app/api/             API routes (health check, image serving, auth)
  components/          UI, split by area (calculators, charts, map,
                        marketplace, provenance, layout)
  lib/                 Business logic: calculators, AI analyst, auth
                        helpers, rate limiting, tiers, enquiry handling
  lib/db/              Database query modules (one per domain: listings,
                        favorites, valuations, market-stats, ...)
  i18n/                next-intl config and the app's own navigation
                        wrapper (always import Link/redirect from here,
                        never next/link or next/navigation directly)
  types/               Shared TypeScript types
prisma/
  schema.prisma        Database schema
  seed.ts              Seeds sample data + the demo admin/agency accounts
messages/
  en.json, ar.json     All UI strings, one key per pair
tests/                 Vitest unit tests, mirroring the src/ layout
docs/
  CONVENTIONS.md        House rules and the full verify recipe (for anyone
                        continuing development on this codebase)
```

## Local setup

1. **PostgreSQL.** Have a local Postgres running, with a database for this
   app. Example one-time setup:
   ```bash
   createuser app --login --pwprompt --createdb   # password: app (or your own)
   createdb opip --owner=app
   ```
2. **Environment.** Copy `.env.example` to `.env` and fill in the required
   values (see the table below) — at minimum `DATABASE_URL`, `AUTH_SECRET`,
   and `SEED_ADMIN_PASSWORD`.
   ```bash
   cp .env.example .env
   ```
3. **Install, sync the schema, seed, and run:**
   ```bash
   npm install
   npx prisma db push     # creates/updates tables from prisma/schema.prisma
   npm run db:seed        # idempotent — sample data + demo accounts
   npm run dev             # http://localhost:3000
   ```
4. Sign in at `/en/login` with `admin@example.com` and the password you set
   in `SEED_ADMIN_PASSWORD` to reach the admin screens (there's also a demo
   `agency@example.com` account with the same password).

## Environment variables

All of these are documented with full context in `.env.example` — this is
just the quick-reference list of names and what each one is for.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js session-signing secret |
| `AUTH_URL` | The app's own public URL, used by Auth.js |
| `DATA_DIR` | Where uploaded property images are written |
| `SEED_ADMIN_PASSWORD` | Password for the seeded admin + demo agency logins |
| `ANTHROPIC_API_KEY` | Powers the AI analyst; without it the analyst card just says it's not switched on yet |
| `NEXT_PUBLIC_MAP_TILE_URL` | Optional: swap the map's tile server (defaults to OpenStreetMap, fine for low traffic only) |
| `SENTRY_DSN` | Optional: error tracking; leave unset to keep it off |
| `REDIS_URL` | Optional: a shared rate-limit store across multiple instances; leave unset for the default in-memory limiter |
| `TRUST_PROXY_HEADERS` | Set to `"true"` only when a reverse proxy in front of the app (e.g. Railway) overwrites the visitor-IP headers itself — see `.env.example` for why this matters |

## Testing

```bash
npm test
```

Runs the Vitest suite in `tests/` — pure-function unit tests for the
calculators, the AI analyst's honesty rules, auth/rate-limit guards, the
admin route gate, and the open-redirect and contact-field validators. No
database is required to run them.

## Deploying (Railway)

The included `railway.json` configures:

- **Build:** `npm run build` (runs `prisma generate` then `next build`)
- **Pre-deploy:** `npx prisma db push` — syncs the database schema before
  each new release goes live
- **Health check:** `GET /api/health` — must return `{"ok":true}`

On Railway, also attach a persistent Volume mounted at `/data` and set
`DATA_DIR=/data`, or uploaded property photos are wiped on every deploy.
Full pre-launch checklist (secrets, payments, email) is in `GO-LIVE.md`.
