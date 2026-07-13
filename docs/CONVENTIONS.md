# Oman Property Intelligence — house rules & verify recipe

This is the conventions doc that `dev-lead`, `builder`, `verifier`, and
`deploy-checker` read before touching this repo. It states the rules that keep
the app consistent; the app registry row lives in `Agents/docs/apps.md`.

## What this app is

A bilingual (English/Arabic) real-estate analytics platform for Oman:
market dashboard per neighborhood, investment calculators, and admin data-entry.
Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4, PostgreSQL +
Prisma 6, Auth.js v5. **Read `AGENTS.md` first — Next 16 has breaking changes
and ships its docs in `node_modules/next/dist/docs/`.**

## House rules (priority order — code review checks these first)

1. **Data honesty is the product.** Every data-bearing record (`MarketStat`,
   `Property`, `Listing`, `ValuationEstimate`) carries `provenance`,
   `confidence`, and `sourceNote`. Every figure shown to users renders a
   `ProvenanceBadge`. Never write a stat without provenance; never display a
   number without its badge nearby. Never label generated/estimated values as
   `VERIFIED` or `OFFICIAL_STAT`.
2. **OMR has 3 decimal places (baisa).** All money columns are
   `Decimal @db.Decimal(12,3)`. Never `Float` for money. Every displayed
   amount goes through `formatOMR` / `formatOMRWhole` in `src/lib/money.ts`
   (Latin digits in Arabic UI). Convert Prisma `Decimal` to string before it
   crosses to a client component.
3. **Bilingual by construction.** Every UI string lives in `messages/en.json`
   AND `messages/ar.json` — added in the same commit, no "translate later".
   Data fields come in `...En`/`...Ar` pairs; Arabic is optional and falls
   back to English (see `src/lib/i18nData.ts`).
4. **RTL via logical properties only.** Use `ms-/me-/ps-/pe-/start-/end-/
   text-start/text-end`, never `ml-/mr-/pl-/pr-/left-/right-/text-left/
   text-right`. The only `dir` switch is in `src/app/[locale]/layout.tsx`.
   Charts and maps are wrapped `dir="ltr"` on purpose.
5. **Navigation via `src/i18n/navigation.ts`** (`Link`, `redirect`,
   `useRouter`, `usePathname`) — never `next/link` or `next/navigation`
   directly, or locale prefixes break.
6. **MarketStat scope uniqueness lives in code, not the DB.** All stat writes
   go through `upsertMarketStat` in `src/lib/db/market-stats.ts` (the unique
   index contains nullable columns, so Postgres can't enforce it).
7. **Role checks in every admin server action** (`auth()` + role === ADMIN),
   not just the route-group layout.
8. **Uploads go under `DATA_DIR`** via `src/lib/storage.ts` and are served by
   `/api/images/[...path]` (path-traversal guarded). On Railway, `DATA_DIR=/data`
   on a mounted Volume — **without the volume, photos are wiped every deploy**.
9. **Calculators are pure functions** in `src/lib/calculators/` with tests in
   `calculators.test.ts`. UI never contains financial math.
10. **Chart colors come from `src/lib/chartPalette.ts`** (validated, fixed
    order). One y-axis per chart, always.

## Verify recipe (what `verifier` runs, in order)

```bash
# One-time per machine: Postgres running, role+db created
#   service postgresql start
#   su postgres -c "psql -c \"CREATE ROLE app LOGIN PASSWORD 'app' CREATEDB;\""
#   su postgres -c "psql -c 'CREATE DATABASE opip OWNER app;'"
# .env needs DATABASE_URL, AUTH_SECRET, DATA_DIR, SEED_ADMIN_PASSWORD (see .env.example)

npm install
npx prisma db push        # schema sync (same as Railway pre-deploy)
npm run db:seed           # idempotent
npm test                  # calculator math
npm run lint
npm run build             # prisma generate && next build
```

Dev-server smoke checks: `/en` 200 · `/ar` contains `dir="rtl"` ·
`/en/market` shows figures · `/en/admin` redirects (307) when signed out ·
`/api/health` returns `{"ok":true}`.

Seeded admin login: `admin@example.com` / the `SEED_ADMIN_PASSWORD` from `.env`.

## Deploy (Railway, matching the owner's other apps)

- Pre-deploy command: `npx prisma db push`
- Volume mounted at `/data`, env `DATA_DIR=/data`
- Env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (public app URL),
  `DATA_DIR`, `ANTHROPIC_API_KEY` (powers the AI analyst — without it the
  analyst card shows a friendly "not switched on yet" message and everything
  else works), optional `NEXT_PUBLIC_MAP_TILE_URL`
- Health endpoint: `/api/health`
- The default OSM tile server is fine for low traffic only; swap
  `NEXT_PUBLIC_MAP_TILE_URL` to Carto/Protomaps before real traffic.

## Roadmap (already designed, schema already in place)

- **Phase 3 — Marketplace**: DONE — public search (`/properties`, URL-param
  filters), property intelligence pages with provenance-labeled financials
  (`src/lib/db/valuations.ts` — every figure carries its own provenance;
  derived figures are always AI_ESTIMATED with capped confidence),
  favorites (login-gated), listing comparison, admin listing moderation
  (`/admin/listings`). Query modules: `src/lib/db/{listings,favorites,valuations}.ts`.
- **Phase 4 — AI analyst**: DONE — leashed Q&A on each property page
  (`AiAnalystCard`, login-gated, 10 questions/user/day). The model
  (`claude-opus-4-8`, structured output) sees ONLY tagged stored figures
  gathered in `src/lib/ai/analyst.ts` (reusing `propertyFinancials` and
  `nearestMarketStat`); `src/lib/ai/analystCore.ts` enforces the honesty
  rules in code after every answer — citations must match offered figures,
  confidence is capped by the weakest cited figure (≤ 0.75), an unsupported
  verdict downgrades to INSUFFICIENT_DATA, and a deterministic sufficiency
  gate skips the API call entirely when the data is too thin. Every answer
  persists to `AiAnalysis` with value snapshots frozen in `AiCitation`.
  Tests: `src/lib/ai/analystCore.test.ts` (runs in `npm test`).
- **Phase 5 — Business**: agency portal (`Agency`, `Inquiry`), admin
  verification queue (`provenance = USER_SUBMITTED AND verifiedAt IS NULL`),
  subscriptions via a regional gateway (Thawani/PayTabs — Stripe does not
  serve Oman merchants).

Each phase should start as a product-manager spec in `Agents/docs/specs/`.
