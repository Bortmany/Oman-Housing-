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
   `VERIFIED` or `OFFICIAL_STAT`. Sample rows carry `isSample`; the badge says
   'Sample data' and public queries hide a sample row once a real row exists
   for the same place, type and month. (The one rule lives in
   `src/lib/db/sampleData.ts`, tested in `sampleData.test.ts`.) An admin
   edit to a seeded home or listing does NOT clear its sample flag — it stays
   'Sample data' (erring on the safe side); only saving a market figure
   through `upsertMarketStat` turns a stat real. "Mark verified" is hidden
   for sample rows in the review queue (and the verify action refuses them).
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
   Charts and maps are wrapped `dir="ltr"` on purpose. The one sanctioned
   exception is Tailwind's `rtl:` variant, used only for things logical
   properties cannot express: mirroring a glyph or icon
   (`rtl:rotate-180`, as in `src/components/ui/DirectionalLink.tsx`) and
   bumping type size for Arabic legibility (`rtl:text-sm`) — never for
   spacing or alignment, which stay logical.
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
   Owner/agency listing photos go one per request through the same function
   (bytes-checked, 5 MB, max 15 per listing); the server-action body limit is
   6 MB in `next.config.ts` for exactly that reason.
   **Listings that owners and agencies share** live in `src/lib/listings/`:
   `rules.ts` (pure rules, `ownsListing`, the form's checks, the state table)
   and `core.ts` (the actions' database half). Every listing action checks
   OWNERSHIP inside its query (`ownershipWhere`), so someone else's listing and
   a missing one are indistinguishable (not-found). **Unreviewed content is never
   public**: every public Property query uses `publicPropertyWhere` (no listings,
   or at least one ACTIVE one). Tests: `listings/rules.test.ts`, `listings/core.test.ts`
   (the first database-backed test; refuses to run off a `_test` database).
9. **Calculators are pure functions** in `src/lib/calculators/` with tests in
   `calculators.test.ts`. UI never contains financial math.
10. **Chart colors come from `src/lib/chartPalette.ts`** (validated, fixed
    order). One y-axis per chart, always.
11. **Schema changes are real migration files.** Edit `prisma/schema.prisma`,
    then run `npx prisma migrate dev --name <what-changed>` against the local
    dev database and commit the new folder under `prisma/migrations/`. Never
    `prisma db push` — Railway applies the committed migrations with
    `npx prisma migrate deploy` before every deploy, so a schema change that
    has no migration file never reaches production.

## Verify recipe (what `verifier` runs, in order)

```bash
# One-time per machine: Postgres running, role+db created
#   service postgresql start            (Mac with Homebrew: brew services start postgresql@16)
#   su postgres -c "psql -c \"CREATE ROLE app LOGIN PASSWORD 'app' CREATEDB;\""
#   su postgres -c "psql -c 'CREATE DATABASE opip OWNER app;'"
# .env needs DATABASE_URL, AUTH_SECRET, DATA_DIR, SEED_ADMIN_PASSWORD (see .env.example)
# (Homebrew Postgres on a Mac: DATABASE_URL="postgresql://<your-mac-username>@localhost:5432/opip"
#  — no password, no role setup needed.)

npm install               # also switches on the pre-push hook (see below)
npx prisma migrate deploy # apply committed migrations to the DEV database (same as Railway pre-deploy)
                          # (changing the schema? `npx prisma migrate dev --name <change>` instead — never `db push`)
npm run db:seed           # idempotent
npm run verify            # lint → typecheck → build → tests, stopping at the first failure
```

**What the seed writes.** Every market figure, property, listing and valuation
the seed creates is invented sample data and is written with `isSample: true`
(badge "Sample data" / "بيانات تجريبية", no confidence percentage). Re-running
it is idempotent and also re-flags seeded rows an older seed wrote without the
flag (the `add_is_sample` migration does the same for databases seeded before
it). Rows written through the app are never sample: `upsertMarketStat`
replaces a sample figure in place and marks it real. Sample listings and homes
step aside publicly once a real live listing exists in the same neighbourhood
and property type; admin screens always show every row, marked.

`npm run verify` is the whole check in one command:
`npm run lint && npm run typecheck && npm run build && npm test`.

**Tests use their own database, never the development one.** `npm test`
first brings the test database up to date with `npx prisma migrate deploy`
(creating it if it doesn't exist — never `db push`, never `migrate dev`),
then runs every test with `DATABASE_URL` pointed at it
(`scripts/with-test-db.mjs`). The test database is `TEST_DATABASE_URL` if set,
otherwise `DATABASE_URL` with `_test` added to the name (`opip` → `opip_test`).
The script refuses to run if the two addresses are the same. To prepare the
test database without running tests: `npm run db:test:prepare`. (Today's
tests are pure logic and don't query the database; the separation is there so
the first test that does can never touch development data.)

**Pre-push hook.** `git push` runs `.husky/pre-push` automatically (installed
by `npm install` via husky). It first checks Postgres is running
(`pg_isready`) and stops with a plain-English note if not, then runs
`npm run verify`; if anything fails, the push is cancelled. In a genuine
emergency, `git push --no-verify` skips it — run `npm run verify` yourself
straight afterwards.

Dev-server smoke checks: `/en` 200 · `/ar` contains `dir="rtl"` ·
`/en/market` shows figures · `/en/admin` redirects (307) when signed out ·
`/api/health` returns `{"ok":true}`.

Seeded admin login: `admin@example.com` / the `SEED_ADMIN_PASSWORD` from `.env`.

## Deploy (Railway, matching the owner's other apps)

- Pre-deploy command: `npx prisma migrate deploy` (applies the committed
  migration files; see house rule 11). Node is pinned to 22 (`.nvmrc`,
  `engines` in `package.json`).
- Volume mounted at `/data`, env `DATA_DIR=/data`
- Env vars:
  - `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (public app URL; the only base for sitemap, robots, canonical, language and share links: `src/lib/siteUrl.ts`), `DATA_DIR`
  - `SEED_ADMIN_PASSWORD` — password given to the seeded `admin@example.com`
    and `agency@example.com` logins by `npm run db:seed`; set a strong one
    before seeding, then remove/rotate those demo accounts before launch.
  - `TRUST_PROXY_HEADERS="true"` — tells the app the `X-Forwarded-For` header
    is trustworthy (true on Railway) so rate limits count per real visitor
    IP. Leave unset locally.
  - `ANTHROPIC_API_KEY` — powers the AI analyst; without it the analyst card
    shows a friendly "not switched on yet" message and everything else works.
  - `CRON_SECRET` — at least 16 characters; the password for the daily job
    `POST /api/jobs/listing-averages` (sent as `Authorization: Bearer ...`).
    Unset or shorter = the job address refuses everyone (503). Railway: run
    the job daily; schedule `0 23 * * *` = 03:00 Oman time. The admin
    "Recompute now" button works without it.
  - `CRON_SECRET` also guards the hourly alert job
    `POST /api/jobs/saved-search-alerts` (saved-search emails). Railway cron:
    `0 * * * *` running `curl -X POST -H "Authorization: Bearer $CRON_SECRET"
    "$AUTH_URL/api/jobs/saved-search-alerts"`. Code: `src/lib/alerts/`
    (runner = at-most-once claim, caps 10/user/24 h, 100/run, 5 listings per
    email; template = pure, EN + AR RTL, plain text always). Failed sends
    count toward the daily cap and a search is left alone after 3 failures in
    24 h. Every alert carries a signed one-click unsubscribe link (HMAC with
    `AUTH_SECRET`; public route `/api/alerts/unsubscribe`, sets the search's
    frequency to `off`) plus `List-Unsubscribe` / `List-Unsubscribe-Post`
    headers. The "alerts are live" notes need email on AND a valid
    `CRON_SECRET` (`src/lib/alerts/live.ts`).
    Map-area search: a home with no coordinates of its own matches by its
    neighbourhood's centre and is marked "approximate" — the centre is never
    stored on the home (`src/lib/approxLocation.ts`).
  - `RESEND_API_KEY` + `EMAIL_FROM` — email provider; dormant until BOTH are
    set (the alert job then reports "not configured" and changes nothing).
  - `EMAIL_DEV_LOG` — `true` writes emails as `.eml` files to
    `DATA_DIR/outbox/` instead of sending. Development only; ignored when
    `NODE_ENV=production`. Never needs a backup.
  - `SENTRY_DSN` — error tracking; empty = off, nothing is sent.
  - `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare
    Turnstile (free CAPTCHA) on the login, register and list-with-us forms.
    Dormant until BOTH are set: no widget is shown and nothing is verified.
    Get the pair from the Cloudflare dashboard (Turnstile → Add site).
  - `NEXT_PUBLIC_STATS_SCRIPT_URL` + `NEXT_PUBLIC_STATS_SITE_ID` (+ optional
    `NEXT_PUBLIC_STATS_ATTR`) — privacy-friendly visitor stats (Plausible
    chosen; Umami/GoatCounter work by settings). Dormant until the script
    address (https only) AND the site id are set: no script tag, CSP unchanged.
    Parsed in `src/lib/stats.ts` (shared by `next.config.ts`, the layout, the
    privacy page and `/api/health`). Cookieless; no consent banner.
  - `SIGNUP_INVITE_CODES` — comma-separated invite codes (8+ chars each).
    Sign-up (buyer register AND agency list-with-us) is invitation-only while
    this is set; in production with it unset and `SIGNUPS_OPEN` unset, sign-up
    is CLOSED. Locally sign-up stays open unless codes are set. Logic and
    tests: `src/lib/signupMode.ts`. Rotate by editing the variable.
  - `SIGNUPS_OPEN="true"` — opens sign-up to everyone (the switch for when
    payments exist). Leave unset for now.
  - `PRIVACY_CONTACT_EMAIL` — optional; the contact address shown as a
    mailto link on the Privacy Policy and Terms of Use pages. Defaults to
    the owner's address (`naeljam@hotmail.com`). Logic and tests:
    `src/lib/legalContact.ts`.
  - `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_VERIFY_SERVICE_SID` —
    Twilio Verify, the SMS that carries the phone code private owners need
    before they can list. Dormant until ALL THREE are set. The site's own
    rules always run (Omani +968 mobiles only, 10-minute expiry, 5 wrong
    tries, 60 s between sends, one verified number per account — logic and
    tests: `src/lib/phoneVerify.ts`). Unset in development: the site makes
    its own code and prints it to the server console. Unset in production:
    phone verification, and so owner listing, is closed (fail closed).
    Provider code: `src/lib/sms/send.ts`.
  - `NEXT_PUBLIC_MAP_PMTILES_URL` — full address of the Protomaps `.pmtiles`
    file (Cloudflare R2). Build-time. When set it wins over
    `NEXT_PUBLIC_MAP_TILE_URL`; when unset the map uses that raster URL
    (default OpenStreetMap). The map style, tile source and attribution are
    decided in one place, `src/components/map/mapStyle.ts`; fonts, icons and
    the Arabic text plugin are served from `public/map`. The CSP derives its
    `connect-src` origin from this variable (`next.config.ts`).
  - optional `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`
    (attribution for the raster path), `REDIS_URL`
- Health endpoint: `/api/health` (a signed-in admin also sees which of the
  optional integrations — Sentry, AI analyst, CAPTCHA — are configured, plus
  `signups: open | invite | closed`, `sms: configured | dormant`)
- The default OSM tile server is fine for low traffic only; set
  `NEXT_PUBLIC_MAP_PMTILES_URL` (Protomaps on R2) before real traffic.

## Roadmap (already designed, schema already in place)

- **Phase 3 — Marketplace**: DONE — public search (`/properties`, URL-param
  filters), property intelligence pages with provenance-labeled financials
  (`src/lib/db/valuations.ts` — every figure carries its own provenance;
  derived figures are always AI_ESTIMATED with capped confidence),
  favorites (login-gated), listing comparison, admin listing moderation
  (`/admin/listings`). Query modules: `src/lib/db/{listings,favorites,valuations}.ts`.
- **Phase 4 — AI analyst**: DONE — leashed Q&A on each property page
  (`AiAnalystCard`, login-gated, 10 questions/user/day). The model
  (`claude-opus-5`, structured output) sees ONLY tagged stored figures
  gathered in `src/lib/ai/analyst.ts` (reusing `propertyFinancials` and
  `nearestMarketStat`); `src/lib/ai/analystCore.ts` enforces the honesty
  rules in code after every answer — citations must match offered figures,
  confidence is capped by the weakest cited figure (≤ 0.75), an unsupported
  verdict downgrades to INSUFFICIENT_DATA, and a deterministic sufficiency
  gate skips the API call entirely when the data is too thin. Every answer
  persists to `AiAnalysis` with value snapshots frozen in `AiCitation`.
  Tests: `src/lib/ai/analystCore.test.ts` (runs in `npm test`).
- **Phase 5 — Business**: DONE (except the parts needing external accounts —
  see below). Buyer enquiries on every property (`EnquiryCard`, open to all
  with an account-creation nudge + honeypot + per-email daily cap;
  `src/lib/db/inquiries.ts`, `src/lib/enquiry.ts`). Self-serve agency signup
  (`/list-with-us`) creates an unapproved `Agency` + an `AGENCY` user; the
  agency portal (`(agency)` route group) lets them submit listings
  (a property + `PENDING_REVIEW` listing together) and see their enquiry inbox.
  Admin oversight (`/admin/{review,agencies,inquiries}`): a unified review
  queue (pending listings + `USER_SUBMITTED AND verifiedAt IS NULL`
  properties/stats), agency approval, and an all-enquiries inbox. Paid-tier
  plumbing (`src/lib/tiers.ts`): each `Tier` caps an agency's in-play listings
  (FREE 3 / PREMIUM 25 / BUSINESS ∞); the owner grants a tier by hand from
  `/admin/agencies` — the same switch a payment webhook will flip.
  `agencyId` now rides on the session (`src/auth.ts`). Tests:
  `src/lib/{tiers,enquiry}.test.ts` (run in `npm test`).
  **Still needs external accounts (deferred):** email notifications (the
  `// TODO(Phase 5 email)` seam in the enquiry action), a Thawani/PayTabs
  checkout that flips the tier automatically (Stripe does not serve Oman
  merchants), and setting the new env vars on Railway.

Each phase should start as a product-manager spec in `Agents/docs/specs/`.
