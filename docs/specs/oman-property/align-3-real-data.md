# Align Step 3 — Real data machinery

App: Oman Property Intelligence. Round: October 2026 alignment, Step 3.
Status: draft for owner approval (owner sitting 1). Written 30 Sep 2026.

Reads with: `docs/decisions/official-data-sources.md` (fixes the CSV columns and level rules — used exactly here), `docs/CONVENTIONS.md` (rules 1, 6, 7, 11), and the Step 1 spec.

Backlog rows this matches: none found by name. `Agents/docs/backlog.md` was not re-read for this spec; the round's build plan (`docs/visions/build/oman-property.md`, "Step 3 — Real data machinery") is the source. The owner should tie this to any backlog row that mentions "real data" or "CSV upload".

## What I could and could not check

- Checked in the worktree code: `MarketStat` and the `DataProvenance` enum (`prisma/schema.prisma`), `upsertMarketStat` and the public stat queries (`src/lib/db/market-stats.ts`), the two `marketStat` readers outside that file (`nearestMarketStat` in `src/lib/db/listings.ts`, `gatherOfferedData` in `src/lib/ai/analyst.ts`), `/admin/market-stats`, `/admin/review` and its actions, the agency route group, `checkRateLimit`, `ProvenanceBadge`, `src/lib/provenance.ts`, `src/proxy.ts`, `requireAdmin` / `enforceAdminPage`, the existing migrations (`init`, `add_saved_searches`), the seed's place names.
- Step 1 spec (`docs/specs/oman-property/align-1-honest-data.md`) does NOT exist yet in this worktree. The `isSample` flag and the "sample rows disappear once a real row exists for that area + type + month" rule are therefore referenced, not defined, here. If Step 1 lands differently from what this spec assumes, the builders reconcile before merging (see "Step 1 hand-off" below).
- Mobbin: no Mobbin tool was available in this session, so I have NOT cited any `mobbin_url`. I will not invent them. `ui-designer` should pull 2–3 flows for "bulk CSV import with preview and per-row errors" (comparable products: bank-statement importers, Shopify product CSV import, Airtable/Notion import) and attach the URLs to the screen spec.
- Not checked: the live site, real MOHUP / NCSI files (the decision file itself says exact columns are unconfirmed — this is why the fixtures matter).

## The problem, in the owner's words (from the build plan)

"The owner and agencies load real figures in bulk, and the site works out its own averages from live listings without ever dressing them up."

Today every number on the market pages was typed in one at a time through the single-row form, and the seeded numbers are sample data. There is no way to load an official file, agencies cannot contribute figures at all, and once real listings exist nothing turns them into averages. The site cannot be honest about "real" data until real data can get in.

Three ways for real figures to arrive, each labelled honestly:

1. The owner uploads an official file (NCSI, MOHUP, CBO) — labelled "Official statistic", with a source link on every row.
2. An approved agency uploads its own figures — held in the review queue as "User submitted", never public until the owner approves.
3. The site averages its own live listings — labelled "From live listings", showing how many listings it is based on, and never allowed to overwrite an official figure.

## Standards note (Agents/docs/engineering-standards.md sections 6–8)

- New personal data collected: NO. Rows are market figures, not people. The uploaded file itself is NOT kept — it is read in memory, and only the validated figures are saved. The only "who" that is stored is the agency's business name inside the row's source note, and that note is visible to the owner only (no public page shows `sourceNote` or `sourceUrl` today — checked). So the privacy page does not have to change in this build. If a builder ends up storing the uploader's user id or keeping the raw file, that flips to YES and `src/app/[locale]/(public)/privacy/page.tsx` must change in the same build.
- Touches the core guarantee (provenance labels and the AI leash): YES, heavily. Tests are REQUIRED in the same builds — listed per build below and again in "Done when". They must be added to the `test:unit` chain in `package.json` so `npm run verify` runs them.
- Adds mutations and external calls: YES. Rate limits (uses `checkRateLimit` in `src/lib/rate-limit.ts`; in-memory per process today, per the file's own note):
  - Admin import: 20 checks per hour and 10 confirms per hour per admin (`admin-import:user:<id>`).
  - Agency upload: 10 checks per hour and 5 confirms per hour per agency user (`agency-data:user:<id>`).
  - Recompute-now button: 6 per hour per admin (`listing-averages:user:<id>`).
  - Job route `/api/jobs/listing-averages`: refuses everything without the correct secret; after that a plain cap of 6 runs per hour per process, so a leaked secret cannot hammer the database.
  - No third-party services are called; nothing new for the privacy page or the security-headers list.

## Conflicts with the app's conventions, and things the plan skipped

1. **Public pages do not hide unapproved rows today.** `latestStatsByNeighborhood`, `latestNeighborhoodStat`, `neighborhoodTrends` (all in `src/lib/db/market-stats.ts`), `nearestMarketStat` (`src/lib/db/listings.ts`) and the AI analyst's stat lookup (`src/lib/ai/analyst.ts`) read `marketStat` with no provenance or approval filter. So an agency row saved as "User submitted" would be PUBLIC the moment it is saved, breaking the plan's "never public until approved". Build A must add one shared visibility rule and apply it to all five readers (details in Build A).
2. **Official governorate figures have nowhere to show.** The decision file says official data lives at governorate (or city) level and "pages show governorate-level figures labelled as such". But `nearestMarketStat` falls back neighbourhood → city → national (skipping governorate), and the market pages only read neighbourhood-level rows. Imported governorate rows would be invisible to visitors. The three briefs in the plan do not include showing them. I have added a small **Build D** for this (it is the difference between "loaded" and "usable"). If the owner declines D, official figures are stored and visible in admin only.
3. **The review page mislabels governorate rows.** `/admin/review` shows "National" for any stat with no neighbourhood and no city, so a governorate row would read as national. Build B fixes this. It also has no "reject" for a stat (only "Mark verified"); Build B adds one.
4. **`upsertMarketStat` overwrites whatever row it finds** (it matches on place + type + month and replaces provenance). Uncontrolled, an agency upload could replace an official figure with a hidden "User submitted" one, and the derived job could replace an official figure with an average. Build A adds an explicit conflict setting to it (rule 6 stays true: every write still goes through it).
5. **The CSV columns have no `national` level** but the decision file's level rules mention national figures (NCSI totals, CBO). See open question 1.

## Who builds what, in what order

Files are owned by exactly one build. A builder may read anything; it may only edit files it owns. Anything not listed is owned by nobody — ask dev-lead.

```
Step 1 (isSample)  ──►  Build A  ──►  Build B  ─┐
   (in progress)         (parser +     Build C  ─┼─►  Build D  ──► verify / review
                          rules)       (parallel) │     (public display)
```

- **Build A goes first, alone.** It writes the one shared CSV parser and the shared rules. B and C must not start until A's parser and rules have landed on the round branch (B needs the parser; C needs the conflict setting and the visibility rule).
- **B and C run in parallel** once A has landed. They touch different files (below).
- **D starts after B and C** (it edits the public market pages, which C's badge change also touches).
- Each builder works in its own worktree with its own test database, as in the build plan.
- Two shared files get one small edit from every builder: `messages/en.json` + `messages/ar.json` (each builder adds ONLY its own top-level key, listed below, so the merges are trivial) and the `test:unit` line in `package.json` (each appends its own test files; dev-lead resolves the trivial merge). Rule 3: strings for en and ar go in the same commit.
- Pure files must NOT use the `@/` import alias — the test runner (`tsx`) does not resolve it (see the note at the top of `src/lib/adminGate.ts`). Use relative imports in the parser, the averages function and their tests.

### Build A — Parser, rules, and admin bulk upload

Owns (creates or edits):
- `src/lib/csv/marketStatsImport.ts` — THE shared parser (pure, no I/O, no `@/`)
- `src/lib/csv/marketStatsImport.test.ts`
- `src/lib/statVisibility.ts` (new, pure) — the one rule for "which stat rows may the public / the AI see", plus `src/lib/statVisibility.test.ts`
- `src/lib/db/market-stats.ts` — add the conflict setting to `upsertMarketStat`; apply the visibility rule to the three public queries in this file
- `src/lib/db/listings.ts` — apply the visibility rule to `nearestMarketStat` only
- `src/lib/ai/analyst.ts` — apply the visibility rule to the `marketStat.findMany` call only
- `src/app/[locale]/(admin)/admin/market-stats/import/page.tsx`, `ImportForm.tsx` (client), `actions.ts`
- `public/templates/market-stats-template.csv` (header row only — no example figures, so nobody imports a "sample" by accident)
- messages: top-level keys `csvImport` (shared error text, used by A and B) and `adminImport`

Behaviour of the parser (`parseMarketStatsCsv`) — the agreed interface B imports:
- Input: the file text, a mode (`"official"` or `"agency"`), whether neighbourhood rows are allowed, and a directory of places `{governorates, cities, neighborhoods}` each as `{id, slug, nameEn, nameAr}` (the caller loads it from the database; the parser never touches the database).
- Output: `{ fileErrors, rowErrors, groups, warnings, counts }`.
  - A `rowError` is `{ line, column, code, value }`. `line` is the line number as the person sees it in Excel (header = line 1, first data row = line 2). `column` is the column name exactly as in the file header. `code` is one of the codes in the string table below. The parser returns codes; the screens turn them into words in the current language.
  - A `group` is one future save: `{ scope, propertyType, periodStart, metrics, confidence, sourceUrl, sourceNote, lines }`. Rows for the same place + type + month are combined into one group (decision file). The parser sets NO provenance — the caller (A's action or B's action) decides that. A file cannot ask for a provenance.
- The parser exports the limits: `MAX_CSV_BYTES = 500 * 1024`, `MAX_ROWS_OFFICIAL = 2000`, `MAX_ROWS_AGENCY = 100`. (500 KB keeps the preview-then-confirm round trip inside Next's default server-action body limit of 1 MB — the builder must confirm the actual limit in `node_modules/next/dist/docs/` per `AGENTS.md`, and lower the cap if it is smaller.)
- It NEVER evaluates cells. Every cell is plain text: a cell starting with `=`, `+`, `-`, `@` is just text (a leading `-` on a number is then rejected as negative). No formula engine, no `eval`, no dynamic import, no HTML — the preview prints cells as escaped text only (React does this by default; do not use `dangerouslySetInnerHTML`).
- No new dependency. It is a small hand-written reader (comma-separated, double quotes, doubled quotes for a literal quote, line breaks inside quotes, a leading byte-order mark stripped, both `\r\n` and `\n`).
- Headers: matched after trimming spaces and ignoring capital letters. Exact names from the decision file: `area_level, area, property_type, metric, value, period_start, period_type, source_url, source_note, confidence`. Required columns must be present. Extra columns are ignored with a yellow warning naming the column (real MOHUP files will have extras).
- Digits: before reading any number, date or confidence, Arabic-Indic digits (U+0660–0669) and Eastern Arabic-Indic digits (U+06F0–06F9) become Latin digits; the Arabic decimal mark (U+066B) becomes `.`; the Arabic thousands mark (U+066C), a comma, or a space is accepted only as a thousands separator in groups of three. Mixed digits in one value ("١٢3.٥٠٠") work. Text columns (`area`, `source_note`) are not touched.
- Values: money metrics (`avgSalePrice`, `medianSalePrice`, `avgRentMonthly`, `avgPricePerSqm`) must be greater than 0 and at most 100,000,000, at most 3 decimals. `grossYieldPct` 0–100 (rounded to 2 decimals, as the column is 2-decimal). `transactionCount` and `sampleSize`: whole numbers 0 or more. `confidence`: 0–1, default 0.9 (agency mode ignores the column and fixes 0.5, the app's existing default for user-submitted data).
- `period_start`: `YYYY-MM-01` only (day must be 01). `period_type` (`month`/`quarter`/`year`, default `month`) is added to the saved source note as text like "(quarter starting 2026-01-01)" — the app stores one row per month, so a quarterly figure sits on the quarter's first month; the note says so.
- `source_url`: required, must be `http://` or `https://`, at most 500 characters. `source_note` at most 500 characters after the parser adds its own suffix.
- Place matching (per the decision file): `area` is a slug, or an exact English or Arabic name, looked up ONLY inside the given `area_level`. Spaces are collapsed, capitals ignored, and Arabic tatweel and short-vowel marks ignored; nothing fuzzier. Not found or found twice within that level → the row is rejected (never guessed). Note the seed already has an Arabic-name clash across levels (city "Bawshar" and neighbourhood "Bausher" are both "بوشر") — this is exactly why `area_level` is required, and it is in the fixtures.
- Neighbourhood rule (decision file): a `neighborhood` row is rejected with `neighborhoodNotAllowed` unless the caller passed "neighbourhood allowed". In admin, that is the tick-box "This source names the neighbourhood". Official data is never spread down onto neighbourhoods by any code path.
- Same place + type + month + metric twice in a file → both lines rejected (`duplicateRow`). Rows combined into one group must agree on `source_url` and `confidence`, otherwise the later line is rejected (`conflictingGroup`).
- Tests (pure, in `marketStatsImport.test.ts`), one per rule above, plus: each fixture file listed at the end of this spec produces exactly the errors named there; provenance is never present in the parser output; a formula-looking cell stays text; a 501 KB file and a 2,001-row file are refused before any row is read.

Behaviour of `statVisibility.ts` (the shared rule, needed because of conflict 1):
- One function that returns the where-clause fragment for "publicly visible stat rows": every row EXCEPT (a) `USER_SUBMITTED` rows not yet approved (`verifiedAt` is empty) and (b) rows Step 1 flags as sample when a real row exists for the same area + type + month. For (b) this build only calls Step 1's rule; it does not redefine it. If Step 1 has already put a shared filter in these five places, A extends that one instead of adding a second.
- Applied to the five readers named in "Conflicts" item 1. The admin pages, the review page and admin counts keep seeing everything.
- Test: an unapproved user-submitted row is not returned to the public queries, an approved one is, official and derived ones are; the AI's lookup uses the same rule.

Behaviour of the `upsertMarketStat` conflict setting (needed for conflict 4): an optional argument `onConflict`: `"replace"` (today's behaviour, the default, so nothing existing changes), `"skip"` (leave any existing row alone and report `skipped`), or `"replace-derived-only"` (replace the row only if the existing row is `LISTING_DERIVED`, otherwise skip). The return value gains `skipped: boolean`. The caller-specific rules: admin import uses `replace`; agency upload uses `skip`; the listing-averages job uses `replace-derived-only`. `"replace-derived-only"` is written by A (as a string option) even though the enum value itself arrives in Build C's migration — A must code it against the string `"LISTING_DERIVED"` in a way that typechecks before C lands (compare via a string constant), and C's tests then prove it.

Behaviour of the admin screen `/admin/market-stats/import` (screen by screen; also see the screens section):
1. Page opens (admin only — `enforceAdminPage()` at the top, before any query, like every admin page). Shows the instructions, a "Download template" link, a file picker, and the tick-box "This source names the neighbourhood". One button: "Check file".
2. "Check file" sends the file to the server. The server (a) checks `requireAdmin()` inside the action (rule 7 — the layout and middleware are not enough), (b) rate-limits, (c) checks size and type, (d) parses and matches places, (e) also looks up which groups already have a row, and returns a PREVIEW. Nothing is written.
3. Preview shows: a summary line ("128 figures ready · 12 will replace an existing figure · 0 problems"), a table of the first 50 groups (place, level, type, month, metrics, source link, and a status: "New" or "Replaces an existing figure ({badge})"), and — if there are problems — a problem table listing EVERY problem (cap display at 200, with "and N more") with line, column, the value found, and the reason in the current language.
4. If there are any problems, "Import" is disabled and the page says to fix the file and check again (all-or-nothing; see open question 2). If none, "Import {n} figures" is enabled.
5. "Import" re-sends the file text with the same tick-box; the server runs the WHOLE check again (never trusting the preview), then saves every group through `upsertMarketStat` as `OFFICIAL_STAT`, `replace`, then refreshes the cached public pages (`updateTag(MARKET_DATA_CACHE_TAG)` and `revalidatePath`, same as the existing single-row save).
6. Success: a green box on the same page — "Imported {n} official figures ({r} replaced an existing figure)." with a link to `/admin/market-stats`. If the server fails part-way, the box says how many were saved and that re-uploading the same file is safe (saving the same row twice just updates it).

### Build B — Agency data upload

Starts after A has landed. Owns:
- `src/app/[locale]/(agency)/agency/data/page.tsx`, `DataUploadForm.tsx` (client), `actions.ts`
- `src/app/[locale]/(agency)/agency/page.tsx` — add a "Upload market data" button to the quick links only
- `src/app/[locale]/(admin)/admin/review/page.tsx` and `actions.ts` — fix the governorate mislabel, show the source note and source link on stat rows, add "Reject" for stat rows, add an "agency upload" hint
- messages: top-level key `agencyData`, plus the new keys it needs inside the existing `admin.review` group

Does NOT touch the parser (A owns it) or `market-stats.ts`.

Behaviour:
1. `/agency/data` is for signed-in agency users whose agency is approved (`isApproved`). The route group layout already requires the AGENCY role and the middleware gate protects the path; the action re-checks role, agency link and approval itself (own-agency rule, the same `requireAgency` idiom as `src/app/[locale]/(agency)/agency/actions.ts` — B writes its own copy inside its own `actions.ts`; that file is not exported, do not edit it). An agency that is not approved yet sees the message "Your agency needs to be approved before you can upload data." and no upload box.
2. Same two-step flow as the admin screen (check → preview → confirm), same parser in `"agency"` mode: at most 100 rows, neighbourhood rows allowed (they land unapproved and the owner checks them; see open question 3), source link required, confidence fixed at 0.5. There is no "names the neighbourhood" tick-box for agencies.
3. On confirm: each group is saved through `upsertMarketStat` as `USER_SUBMITTED`, confidence 0.5, `onConflict: "skip"`, with `sourceNote` = "Submitted by agency: {agency English name}" followed by " — {source_note}" if the file gave one (same wording idiom as agency listings already use), and `sourceUrl` from the file. Groups where a figure already exists are NOT saved and are reported: "{n} rows skipped because a figure already exists for that area, type and month."
4. Abuse limits: 100 rows per file; at most 200 unapproved rows per agency waiting in the queue at once (further uploads refused with a message until the owner clears some); the rate limits in the standards note.
5. Result: "Received {n} figures. They are not public yet — the site owner reviews each one first." with a link back to the dashboard.
6. Nothing an agency uploads is ever public until approved: this is guaranteed by A's visibility rule, and B's tests must prove the end-to-end path (an agency-mode parse can never yield `OFFICIAL_STAT` or `VERIFIED`; an agency save never replaces an existing row; the saved row carries the agency name).
7. Admin side (`/admin/review`): the "Unverified market statistics" section already lists `USER_SUBMITTED` rows with no `verifiedAt`. B changes: the place label shows the governorate name for governorate rows (today it says "National"); each row also shows the source note (contains the agency name) and a link to the source URL; a "Reject" button deletes the row (admin role check in the action + the existing per-admin rate limit; no new prompt beyond the existing pattern). "Mark verified" stays as is (it already stamps who and when).

### Build C — Averages from live listings

Starts after A has landed (needs the conflict setting). Owns:
- `prisma/schema.prisma` and one new migration folder — additive only: one new value `LISTING_DERIVED` at the end of the `DataProvenance` enum. Made with `npx prisma migrate dev --name add-listing-derived-provenance`; never `db push` (rule 11). No column, table or index changes.
- `src/lib/calculators/listingAverages.ts` (pure, no `@/`) and its tests, added as a new section in `src/lib/calculators/calculators.test.ts` (rule 9)
- `src/lib/listingAveragesJob.ts` — the database part: reads live listings, calls the pure function, saves through `upsertMarketStat`
- `src/app/api/jobs/listing-averages/route.ts`
- `src/app/[locale]/(admin)/admin/market-stats/page.tsx` (adds two things: the "Recompute now" panel and a link "Bulk upload official data" to A's page), `RecomputeButton.tsx`, `recompute-actions.ts` (new files in that folder)
- `src/app/[locale]/(admin)/admin/market-stats/actions.ts` and `MarketStatForm.tsx` — only to keep `LISTING_DERIVED` OUT of the manual provenance dropdown
- `src/lib/provenance.ts` — add the badge colour for the new value in `provenanceStyles` (teal, distinct from the other four). Do NOT add it to `PROVENANCE_VALUES`: that list feeds the manual forms, and a person must never be able to type a figure in as "from live listings". Leave a one-line comment saying so.
- `src/components/provenance/ProvenanceBadge.tsx` — new optional `sampleSize` prop; when the provenance is `LISTING_DERIVED` and a count is given, the badge reads "From live listings · {n}" (strings below). Callers on admin pages and the admin market-stats page pass it; the public pages are D's.
- `src/components/marketing/HonestData.tsx` — add a legend line for the new label
- `.env.example` and the env-var list in `docs/CONVENTIONS.md` — add `CRON_SECRET`, with the Railway note ("run daily; schedule `0 23 * * *` = 03:00 Oman time"). The owner still has to set the secret and the schedule on Railway (setup the code cannot do — goes into GO-LIVE as the plan says).
- messages: `provenance.LISTING_DERIVED` (+ two hint keys) and a top-level key `listingAverages`

The pure function `listingAverages` (in: a list of live listings `{listingType, price, rentPeriod, areaSqm, propertyType, neighborhoodId, cityId, governorateId}`; out: a list of computed rows):
- Groups by place (neighbourhood, and also city and governorate roll-ups pooled from the listings beneath them) and by property type. There is NO "all types" roll-up (mixing villas and apartments in one average is misleading).
- Sale listings give: mean price (`avgSalePrice`), median price (`medianSalePrice`), and mean price per square metre (`avgPricePerSqm`, using only listings that have an area above 0; it needs its own 5).
- Rent listings give `avgRentMonthly` (annual rents divided by 12 first). Rent and sale are never mixed.
- Minimum sample: 5 listings for each metric. Fewer than 5 → that metric is not produced; a group with no metric produced makes no row. This applies to every place level separately.
- Confidence from the count: 0.30 at 5 listings, rising 0.02 per extra listing, capped at 0.60 (so always below official's 0.9 default and below the app's AI cap of 0.75 — proven by a test). The row's `sampleSize` is the smallest count among the metrics it contains; the exact counts go into the source note as text ("Sale: 7 active listings, rent: 5 active listings. Asking prices, not sale prices. Computed 2026-10-03.").
- Always states that these are ASKING prices. Money is computed as decimal-safe numbers rounded to 3 places (rule 2) and stored via the existing Decimal columns.
- Ignores listings with a non-positive price, and only ever receives ACTIVE listings. It also must not receive listings or properties that Step 1 marks as sample (the job filters them out; if Step 1 does not flag listings, the job filters out the seeded demo listings the way Step 1 defines them — confirm at build).
- Tests: median with odd and even counts; exactly 4 vs 5 listings; annual→monthly; per-sqm using only listings with area; confidence at n=5, 20, 200 (never above 0.60); city roll-up equals pooling its neighbourhoods; no all-types row.

The job (`listingAveragesJob`, called by both the route and the button):
- Computes for the current calendar month (UTC first day of the month). Saves each row through `upsertMarketStat` with `provenance: LISTING_DERIVED`, `onConflict: "replace-derived-only"`. It NEVER replaces a row that is anything other than `LISTING_DERIVED` (official, verified, user-submitted). Skipped-because-official counts are returned so the admin sees them.
- A derived row from an earlier run this month whose place no longer has 5 listings is deleted (a stale average is a made-up number). Derived rows from earlier months are left as history.
- Never writes a row to the review queue (derived rows are not `USER_SUBMITTED`).
- Refreshes the cached public pages after writing.

The route `/api/jobs/listing-averages`:
- `POST` only (a `GET` returns 405). Requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time. If `CRON_SECRET` is not set or is shorter than 16 characters, the route refuses everything with a 503 (safe default: it can never run open). No session is used. `src/proxy.ts` already lets `/api` requests pass untouched — verified — so no proxy change.
- Returns plain JSON: `{ ok: true, written, skippedOfficial, deleted }`.

The "Recompute now" button (admin only): a small panel above the stats table — "Averages from live listings" with the last-run time and result, and a button "Recompute now". The action does `requireAdmin()` itself, rate-limits (6 per hour), runs the job, and shows the result text. No page reload tricks: it uses the same result-box pattern as the other admin forms.

### Build D — Show governorate-level official figures (small)

Starts after B and C. Owns:
- `src/lib/db/market-stats.ts` — one new cached query for the latest governorate-level and city-level rows for a neighbourhood's parent places (uses A's visibility rule), and nothing else in that file
- `src/app/[locale]/(public)/market/[neighborhood]/page.tsx` and `src/app/[locale]/(public)/market/page.tsx` — add the labelled "area-level figure" card; pass `sampleSize` to `ProvenanceBadge` where a `LISTING_DERIVED` row is shown
- `src/app/[locale]/(public)/market/compare/page.tsx` — pass `sampleSize` to the badge only
- messages: top-level key `areaFigure`

Behaviour: on a neighbourhood page, below its own figures, a card titled "Muscat governorate, official" (or "Seeb, official" for a city-level row) shows the latest official figures for the governorate and city with their badge, the month, and the sentence "This is a figure for the whole {area}, not for {neighbourhood} on its own." It is never merged into the neighbourhood's own numbers, charts or averages, and nothing is copied down to the neighbourhood. If there is no governorate or city figure, the card is not shown (no empty card). Needs `ui-designer` first (see below).

## Screens: what the user sees, screen by screen

`ui-designer` should run BEFORE builders A, B and D start (C's screens are two small pieces). Deliver one screen spec covering phone and laptop, both directions, with the states below. Prior art: to be attached by `ui-designer` from Mobbin (see "What I could and could not check").

1. Admin — `/admin/market-stats/import`
   - Empty: instructions (three short steps), "Download template", file picker, tick-box, "Check file".
   - Checking: the button shows "Checking…" and is disabled.
   - Preview OK: summary bar, table of the first 50 figures with status chip, "Import" enabled, "Choose a different file".
   - Preview with problems: summary bar in red, problem table (Line / Column / Found / Problem), "Import" disabled.
   - Imported: green result box and a link to the stats list.
   - Refused: too big, too many rows, wrong file type, empty file, rate-limited ("Too many uploads. Try again in {minutes} minutes.").
   - On a phone the two tables scroll sideways inside a card (same pattern as the existing stats table's `overflow-x-auto`); problem rows may stack as cards below 640 px. Column names and numbers in the tables stay left-to-right inside Arabic pages (like the charts do), everything else follows the page direction with logical spacing only (rule 4).
2. Agency — `/agency/data`: same six states, agency wording, plus the "not approved yet" state and the "queue full" state.
3. Admin — `/admin/market-stats` (existing): two additions — a "Bulk upload official data" link next to "Add market statistic", and the "Averages from live listings" panel with "Recompute now".
4. Admin — `/admin/review` (existing): stat rows now show place (governorate-correct), agency note, source link, "Mark verified", "Reject".
5. Public — neighbourhood page: the "area-level figure" card (Build D) and the new badge "From live listings · 7".
6. Every place a stat figure appears already renders a `ProvenanceBadge` (rule 1); the new badge must appear everywhere the old ones do — including `/admin/market-stats` and the review page — never a bare number.

## Bilingual note (rule 3)

- Every string below is in BOTH `messages/en.json` and `messages/ar.json`, added in the same commit as the code that uses it. Arabic wording is formal and short; the owner or a native reviewer should skim the Arabic once before release (I wrote it, but it has not been checked by a native speaker).
- The CSV column names, metric names (`avgSalePrice`), level names (`governorate`) and property-type names (`APARTMENT`) stay in English in the file, because the decision file fixes them. Arabic is accepted where it matters for the data itself: place names in the `area` column, and Arabic-Indic digits in numbers and dates.
- Error messages are shown in the language the person is using. Because each message includes the column name (Latin) and the value found (any script), wrap those two bits so they display correctly inside Arabic sentences (the app's usual `dir="ltr"` inline wrapper), while the sentence itself follows RTL.
- Files may be saved in UTF-8 only. A file in another Arabic encoding (Windows-1256, common from older Excel) will show garbled names and fail place matching; the message `notUtf8` tells the person to save as "CSV UTF-8".
- Money shown anywhere goes through `formatOMR` / `formatOMRWhole` (Latin digits in Arabic pages, rule 2). Months use `formatMonth` from `src/lib/i18nData.ts`.

### Exact strings

Shared error text — namespace `csvImport` (owned by A, used by A and B). `{line}` = line number, `{column}` = column name, `{value}` = the text found. Row errors read as one sentence with "Line {line}, column {column}:" in front — the screen puts line and column in their own table columns too.

| Key | English | Arabic |
|---|---|---|
| `errors.fileTooBig` | The file is larger than 500 KB. Split it into smaller files. | حجم الملف أكبر من 500 كيلوبايت. قسّمه إلى ملفات أصغر. |
| `errors.tooManyRows` | The file has more than {max} rows. Split it and upload the parts one by one. | يحتوي الملف على أكثر من {max} صف. قسّمه وارفع الأجزاء واحدًا تلو الآخر. |
| `errors.notCsv` | This does not look like a CSV file. Save it as "CSV UTF-8 (comma delimited)" and try again. | لا يبدو أن هذا ملف CSV. احفظه بصيغة «CSV UTF-8 (مفصول بفواصل)» ثم حاول مرة أخرى. |
| `errors.notUtf8` | The file is not saved as UTF-8, so Arabic names cannot be read. Save it as "CSV UTF-8" and try again. | الملف غير محفوظ بترميز UTF-8 لذا تتعذّر قراءة الأسماء العربية. احفظه بصيغة «CSV UTF-8» ثم حاول مرة أخرى. |
| `errors.wrongDelimiter` | The columns must be separated by commas. This file uses semicolons or tabs. | يجب الفصل بين الأعمدة بفواصل. يستخدم هذا الملف فاصلة منقوطة أو علامات جدولة. |
| `errors.empty` | The file has no data rows. | الملف لا يحتوي على أي صفوف بيانات. |
| `errors.missingColumn` | Column {column} is missing from the first line. | العمود {column} غير موجود في السطر الأول. |
| `errors.duplicateColumn` | Column {column} appears more than once in the first line. | العمود {column} مكرر في السطر الأول. |
| `errors.required` | Line {line}, column {column}: this cannot be empty. | السطر {line}، العمود {column}: لا يمكن ترك هذا الحقل فارغًا. |
| `errors.badAreaLevel` | Line {line}, column {column}: "{value}" is not a level. Use governorate, city or neighborhood. | السطر {line}، العمود {column}: «{value}» ليس مستوى صالحًا. استخدم governorate أو city أو neighborhood. |
| `errors.areaNotFound` | Line {line}, column {column}: no {level} called "{value}" was found. | السطر {line}، العمود {column}: لم يُعثر على {level} باسم «{value}». |
| `errors.areaAmbiguous` | Line {line}, column {column}: "{value}" matches more than one {level}. Use the slug instead. | السطر {line}، العمود {column}: «{value}» يطابق أكثر من {level}. استخدم المعرّف (slug) بدلًا منه. |
| `errors.neighborhoodNotAllowed` | Line {line}, column {column}: official figures are not accepted for a single neighborhood unless the source names it. | السطر {line}، العمود {column}: لا تُقبل الأرقام الرسمية لحيّ بمفرده ما لم يذكره المصدر. |
| `errors.badPropertyType` | Line {line}, column {column}: "{value}" is not a property type. Use APARTMENT, VILLA, TOWNHOUSE, PENTHOUSE, LAND, OFFICE, RETAIL or WAREHOUSE, or leave it empty for all types. | السطر {line}، العمود {column}: «{value}» ليس نوع عقار صالحًا. استخدم APARTMENT أو VILLA أو TOWNHOUSE أو PENTHOUSE أو LAND أو OFFICE أو RETAIL أو WAREHOUSE، أو اتركه فارغًا لكل الأنواع. |
| `errors.badMetric` | Line {line}, column {column}: "{value}" is not a known figure. Use avgSalePrice, medianSalePrice, avgRentMonthly, avgPricePerSqm, grossYieldPct, transactionCount or sampleSize. | السطر {line}، العمود {column}: «{value}» ليس مؤشرًا معروفًا. استخدم avgSalePrice أو medianSalePrice أو avgRentMonthly أو avgPricePerSqm أو grossYieldPct أو transactionCount أو sampleSize. |
| `errors.badNumber` | Line {line}, column {column}: "{value}" is not a number. | السطر {line}، العمود {column}: «{value}» ليس رقمًا. |
| `errors.outOfRange` | Line {line}, column {column}: "{value}" is outside the allowed range for this figure. | السطر {line}، العمود {column}: «{value}» خارج النطاق المسموح به لهذا المؤشر. |
| `errors.tooManyDecimals` | Line {line}, column {column}: "{value}" has more than 3 decimal places. | السطر {line}، العمود {column}: «{value}» يحتوي على أكثر من 3 منازل عشرية. |
| `errors.badDate` | Line {line}, column {column}: "{value}" is not a valid month start. Use the first day of the month, like 2026-01-01. | السطر {line}، العمود {column}: «{value}» ليس بداية شهر صالحة. استخدم اليوم الأول من الشهر مثل 2026-01-01. |
| `errors.badPeriodType` | Line {line}, column {column}: "{value}" is not a period type. Use month, quarter or year. | السطر {line}، العمود {column}: «{value}» ليس نوع فترة صالحًا. استخدم month أو quarter أو year. |
| `errors.badUrl` | Line {line}, column {column}: "{value}" is not a web address starting with http:// or https://. | السطر {line}، العمود {column}: «{value}» ليس عنوان ويب يبدأ بـ http:// أو https://. |
| `errors.badConfidence` | Line {line}, column {column}: "{value}" must be a number from 0 to 1. | السطر {line}، العمود {column}: «{value}» يجب أن يكون رقمًا من 0 إلى 1. |
| `errors.tooLong` | Line {line}, column {column}: this text is longer than 500 characters. | السطر {line}، العمود {column}: هذا النص أطول من 500 حرف. |
| `errors.duplicateRow` | Line {line}: the same area, type, month and figure already appears on an earlier line. | السطر {line}: تكرّر نفس المكان والنوع والشهر والمؤشر في سطر سابق. |
| `errors.conflictingGroup` | Line {line}, column {column}: rows for the same area, type and month must share the same source link and confidence. | السطر {line}، العمود {column}: يجب أن تشترك صفوف المكان والنوع والشهر نفسها في رابط المصدر ودرجة الثقة. |
| `warnings.ignoredColumn` | Column {column} is not used and was ignored. | العمود {column} غير مستخدم وقد تم تجاهله. |

Admin screen — namespace `adminImport`:

| Key | English | Arabic |
|---|---|---|
| `title` | Bulk upload official data | رفع البيانات الرسمية دفعة واحدة |
| `lede` | Load official figures from a CSV file. Every row needs a link to the official source. Nothing is saved until you confirm. | حمّل أرقامًا رسمية من ملف CSV. يحتاج كل صف إلى رابط المصدر الرسمي. لا يُحفظ شيء حتى تؤكّد. |
| `step1` | Download the template and fill in one row per figure. | نزّل القالب واملأ صفًا واحدًا لكل رقم. |
| `step2` | Upload the file and check the preview. | ارفع الملف وراجع المعاينة. |
| `step3` | Confirm to save the figures as "Official statistic". | أكّد لحفظ الأرقام بوصف «إحصاء رسمي». |
| `levelRule` | Official figures are stored for the governorate or city they describe. They are never copied onto neighborhoods. | تُحفظ الأرقام الرسمية للمحافظة أو المدينة التي تصفها، ولا تُنسخ أبدًا إلى الأحياء. |
| `template` | Download template | تنزيل القالب |
| `file` | CSV file | ملف CSV |
| `namesNeighborhood` | This source names the neighborhood | يذكر هذا المصدر الحيّ بالاسم |
| `namesNeighborhoodHint` | Tick only if the official source itself gives figures for the neighborhoods in this file. | فعّل هذا الخيار فقط إذا كان المصدر الرسمي نفسه يعطي أرقامًا للأحياء الواردة في هذا الملف. |
| `check` | Check file | فحص الملف |
| `checking` | Checking… | جارٍ الفحص… |
| `chooseAnother` | Choose a different file | اختيار ملف آخر |
| `summaryOk` | {ready, plural, one {# figure ready} other {# figures ready}} · {replace} will replace an existing figure · no problems | {ready, plural, zero {لا أرقام جاهزة} one {رقم واحد جاهز} two {رقمان جاهزان} few {# أرقام جاهزة} many {# رقمًا جاهزًا} other {# رقم جاهز}} · {replace} سيستبدل رقمًا موجودًا · لا مشاكل |
| `summaryProblems` | {count, plural, one {# problem found} other {# problems found}}. Fix the file and check it again. Nothing was saved. | {count, plural, zero {لا مشاكل} one {تم العثور على مشكلة واحدة} two {تم العثور على مشكلتين} few {تم العثور على # مشاكل} many {تم العثور على # مشكلة} other {تم العثور على # مشكلة}}. أصلح الملف وافحصه مرة أخرى. لم يُحفظ أي شيء. |
| `previewHeading` | Preview (first {n} figures) | معاينة (أول {n} رقمًا) |
| `problemsHeading` | Problems | المشاكل |
| `moreProblems` | …and {n} more problems | …و{n} مشكلة أخرى |
| `col.line` | Line | السطر |
| `col.column` | Column | العمود |
| `col.found` | Found | القيمة |
| `col.problem` | Problem | المشكلة |
| `col.area` | Area | المكان |
| `col.level` | Level | المستوى |
| `col.type` | Type | النوع |
| `col.month` | Month | الشهر |
| `col.figures` | Figures | الأرقام |
| `col.source` | Source | المصدر |
| `col.status` | Status | الحالة |
| `status.new` | New | جديد |
| `status.replaces` | Replaces an existing figure | يستبدل رقمًا موجودًا |
| `import` | Import {n} figures | استيراد {n} رقمًا |
| `importing` | Importing… | جارٍ الاستيراد… |
| `done` | Imported {n} official figures ({r} replaced an existing figure). | تم استيراد {n} رقمًا رسميًا (استبدل {r} منها رقمًا موجودًا). |
| `donePartial` | Saved {saved} of {total} figures before an error stopped the import. It is safe to upload the same file again. | تم حفظ {saved} من أصل {total} رقمًا قبل أن يوقف خطأ ما الاستيراد. يمكنك رفع الملف نفسه مرة أخرى بأمان. |
| `viewStats` | View market statistics | عرض إحصاءات السوق |
| `rateLimited` | Too many uploads. Try again in {minutes} minutes. | عدد كبير من عمليات الرفع. حاول مرة أخرى بعد {minutes} دقيقة. |
| `notAllowed` | You do not have permission to do this. | ليس لديك صلاحية لتنفيذ هذا الإجراء. |
| `serverError` | Something went wrong. Nothing was changed. Try again. | حدث خطأ ما. لم يتغيّر شيء. حاول مرة أخرى. |

Agency screen — namespace `agencyData`:

| Key | English | Arabic |
|---|---|---|
| `title` | Upload market data | رفع بيانات السوق |
| `lede` | Share market figures from your own records. Each figure needs a source link. The site owner reviews every figure before anyone else can see it. | شارك أرقام السوق من سجلاتك. يحتاج كل رقم إلى رابط مصدر. يراجع مالك الموقع كل رقم قبل أن يراه أي شخص آخر. |
| `notApproved` | Your agency needs to be approved before you can upload data. | يجب اعتماد وكالتك قبل أن تتمكن من رفع البيانات. |
| `queueFull` | You already have {n} figures waiting for review. Please wait until the owner has reviewed some of them. | لديك بالفعل {n} رقمًا بانتظار المراجعة. يرجى الانتظار حتى يراجع المالك بعضها. |
| `limits` | Up to 100 rows per file. Neighborhood rows are allowed; they are checked by the owner. | حتى 100 صف في الملف. يُسمح بصفوف الأحياء وسيتحقق منها المالك. |
| `check` | Check file | فحص الملف |
| `submit` | Send {n} figures for review | إرسال {n} رقمًا للمراجعة |
| `done` | Received {n} figures. They are not public yet — the site owner reviews each one first. | تم استلام {n} رقمًا. ليست عامة بعد — يراجع مالك الموقع كل رقم أولًا. |
| `skipped` | {n} rows were skipped because a figure already exists for that area, type and month. | تم تخطي {n} صفًا لأن هناك رقمًا موجودًا لذلك المكان والنوع والشهر. |
| `back` | Back to dashboard | العودة إلى لوحة التحكم |
| `dashboardButton` | Upload market data | رفع بيانات السوق |

The agency screen also reuses `adminImport` wording for the shared table headers only where the words are identical; the builder may copy those keys under `agencyData` rather than cross-reading a namespace another build owns.

Review queue additions — inside existing `admin.review`:

| Key | English | Arabic |
|---|---|---|
| `reject` | Reject | رفض |
| `governorateScope` | {name} governorate | محافظة {name} |
| `sourceLink` | Source | المصدر |
| `agencyUpload` | Agency upload | رفع من وكالة |

(The existing key `admin.review.reject` for listings already exists with wording "Reject"; the builder reuses it rather than adding a duplicate.)

Provenance and averages — `provenance.*` and `listingAverages`:

| Key | English | Arabic |
|---|---|---|
| `provenance.LISTING_DERIVED` | From live listings | من الإعلانات النشطة |
| `provenance.listingCount` | {count, plural, one {based on # listing} other {based on # listings}} | {count, plural, zero {} one {بناءً على إعلان واحد} two {بناءً على إعلانين} few {بناءً على # إعلانات} many {بناءً على # إعلانًا} other {بناءً على # إعلان}} |
| `provenance.listingHint` | Average of asking prices in current live listings. These are not sale prices. | متوسط أسعار الطلب في الإعلانات النشطة حاليًا. هذه ليست أسعار بيع فعلية. |
| `listingAverages.panelTitle` | Averages from live listings | متوسطات من الإعلانات النشطة |
| `listingAverages.panelBody` | Works out averages from active listings, at least 5 per figure. Never replaces an official or verified figure. Runs automatically each day. | يحسب متوسطات من الإعلانات النشطة، بحد أدنى 5 إعلانات لكل رقم. لا يستبدل أبدًا رقمًا رسميًا أو موثّقًا. يعمل تلقائيًا كل يوم. |
| `listingAverages.recompute` | Recompute now | إعادة الحساب الآن |
| `listingAverages.running` | Working it out… | جارٍ الحساب… |
| `listingAverages.result` | Done. {written} figures written, {kept} left alone because an official or verified figure exists, {removed} removed because there are now fewer than 5 listings. | تم. كُتب {written} رقمًا، وتُرك {kept} لوجود رقم رسمي أو موثّق، وحُذف {removed} لأن عدد الإعلانات أصبح أقل من 5. |
| `listingAverages.rateLimited` | Too many recalculations. Try again in {minutes} minutes. | عدد كبير من عمليات إعادة الحساب. حاول مرة أخرى بعد {minutes} دقيقة. |
| `listingAverages.bulkLink` | Bulk upload official data | رفع البيانات الرسمية دفعة واحدة |
| `honestyLegendDerived` (in the marketing key group that holds the other legend lines) | Averaged from asking prices in live listings on this site, with the number of listings shown. Never presented as official. | متوسط أسعار الطلب في الإعلانات النشطة على هذا الموقع، مع عرض عدد الإعلانات. لا يُعرض أبدًا على أنه رسمي. |

Public display — namespace `areaFigure` (Build D):

| Key | English | Arabic |
|---|---|---|
| `governorateTitle` | {name} governorate, official | محافظة {name}، رسمي |
| `cityTitle` | {name}, official | {name}، رسمي |
| `notThisArea` | This is a figure for the whole {area}, not for {neighborhood} on its own. | هذا رقم لكامل {area} وليس لحيّ {neighborhood} وحده. |

## Data touched (plain terms)

- Every market figure ("MarketStat") keeps the label it already has: where it came from, how sure we are, a note, and a source link. No new columns and no new tables.
- One new label value exists after this build: "From live listings". It is added to the list of allowed labels through a proper migration (additive; existing rows and existing code paths are untouched).
- Official uploads write figures labelled "Official statistic" (confidence 0.9 unless the file says otherwise), each with its source link, at governorate or city level (neighbourhood only if the owner ticks the box).
- Agency uploads write figures labelled "User submitted" (confidence 0.5) with the agency's name in the note; they stay hidden until the owner approves each one, and rejecting one deletes it.
- Live-listing averages write figures labelled "From live listings" for the current month at neighbourhood, city and governorate level, with the listing count and an "asking prices" note. They only ever replace older derived figures.
- Uploaded files are not kept. Nothing about the people who upload is added to any record.
- Reading: the job reads active listings (their price, type, rent period, area and place). It does not read or copy any buyer or agent contact details.

## Explicitly OUT of scope

- Storing total traded value, price-index values and percentage changes (NCSI); the importer ignores those metrics in v1 — the decision file lists this as "an idea, not built". A `metric` value outside the seven allowed ones is rejected, not silently dropped.
- Excel (.xlsx) and PDF files; only UTF-8 CSV. No importing straight from a web address or from the MOHUP / NCSI sites; no scheduled fetching of official files.
- Editing or deleting imported rows in bulk; approving agency rows in bulk (the owner approves one at a time in v1 — the 100-row and 200-pending caps keep that manageable).
- A history of uploads or an "undo import" button (re-uploading a corrected file replaces the rows; deleting is done from the stats list as today).
- Storing the uploaded file, or who uploaded which batch.
- Deriving yield from listings; national-level averages; "all types" averages; averaging sold or rented listings; averages from the AI's own estimates.
- Any change to the AI analyst beyond the visibility rule; it will treat the new label like any other tagged figure and the existing confidence cap (0.75) already sits above the derived cap (0.60). Any new AI behaviour is a separate spec.
- Payments, tiers, listing-photo work, alerts, maps (Steps 4–6).
- Choosing the definitive MOHUP / NCSI column layout — the decision file says these are unconfirmed; the app's own template is the contract, and turning a real MOHUP download into that template is the owner's job for now.

## Step 1 hand-off (reference, not redefinition)

- Step 1 adds `isSample` flags and the rule "sample rows disappear once a real row exists for that area + type + month". Every row written by A, B (once approved) or C is a real row (`isSample` false), so it hides matching sample rows automatically.
- Build A checks, at the start, whether Step 1 has already added a shared visibility filter. If yes, A extends that filter; if no, A creates `statVisibility.ts` and Step 1's builder is told to use it. Either way there must end up being exactly one filter.
- If Step 1 flags `Listing` or `Property` as sample, Build C excludes them from the averages. If it does not, C asks dev-lead how to recognise the seeded demo listings before building.

## Done when (a non-developer can check each line)

Official upload (Build A)
- [ ] Signed in as admin, `/admin/market-stats/import` opens; signed out or as an agency it redirects to sign-in.
- [ ] Uploading `market-stats-official-good.csv` shows a preview with the right counts and NO save; the stats list is unchanged until I press Import.
- [ ] After Import, the new figures appear in `/admin/market-stats` with the "Official statistic" badge and a source link on every row.
- [ ] Uploading `market-stats-official-bad-header.csv` shows a clear "Column … is missing" message; nothing can be imported.
- [ ] Uploading `market-stats-official-neighborhood-row.csv` refuses the neighbourhood row with the "not accepted for a single neighborhood" message; ticking the box (and only then) lets that row through, and the file's other rows still work.
- [ ] Every problem in `market-stats-official-mixed-errors.csv` is listed with its line number and column name, in English and again when I switch the site to Arabic.
- [ ] `market-stats-official-arabic-names.csv` and `market-stats-official-mixed-digits.csv` import cleanly and give the same numbers as their plain-English twin.
- [ ] A file over 500 KB, or with too many rows, is refused with a plain message before anything is read into the preview.
- [ ] Pressing the check button many times quickly gets the "Too many uploads" message.
- [ ] A formula in a cell (for example `=1+1`) is shown as plain text, never calculated.
- [ ] Importing the same file twice leaves the same figures (updated, not doubled).
- [ ] Official figures never appear on a neighbourhood as if they were the neighbourhood's own.

Agency upload (Build B)
- [ ] Signed in as an approved agency, `/agency/data` opens and there is a button on the agency dashboard; an unapproved agency sees "needs to be approved" and no upload box; the admin cannot reach it and the agency cannot reach `/admin/...`.
- [ ] After an agency confirms a file, the figures appear in `/admin/review` with the agency's name and source link, and the public market pages do NOT show them.
- [ ] After I press "Mark verified" on one, it appears publicly; after "Reject" on another, it is gone.
- [ ] An agency upload never replaces an existing figure; the summary says how many rows were skipped.
- [ ] A governorate-level row shows the governorate's name in the review list, not "National".
- [ ] An agency cannot make a row "Official statistic" or "Verified" by any column in the file.

Live-listing averages (Build C)
- [ ] With fewer than 5 matching active listings, no average appears; with 5 or more, "Recompute now" creates a figure badged "From live listings · N" where N is the true count.
- [ ] Where an official (or verified) figure already exists for that place, type and month, the average is NOT written; the result message says it was left alone.
- [ ] The job address refuses a call with no secret or the wrong secret, refuses a plain browser visit, and works with the right secret; with `CRON_SECRET` unset it refuses everyone.
- [ ] Derived confidence is never above 60%.
- [ ] "From live listings" cannot be picked in the manual "Add market statistic" form.
- [ ] Deleting listings so a place drops below 5 and recomputing removes that place's average.

Public display (Build D)
- [ ] A neighbourhood page shows a separate "Muscat governorate, official" card with the sentence that it is for the whole area; it never changes the neighbourhood's own numbers; no card appears when there is no such figure.

All builds
- [ ] Every new screen and message is in English and Arabic and reads right-to-left correctly; no left/right spacing classes were used.
- [ ] Every figure shown anywhere has its badge next to it.
- [ ] The migration is a committed folder under `prisma/migrations/` and only adds one label value.
- [ ] Tests exist and run inside `npm run verify`: parser rules and every fixture; visibility (unapproved never public); "agency path can never yield official"; "derived never overwrites official"; listing-average maths, minimum of 5, confidence cap; the job's secret check.
- [ ] `npm run verify` passes on the round branch after all four builds are merged.

## Fixtures `content-curator` must make (`prisma/fixtures/`)

Use only places that exist in the seed: governorates `muscat` (مسقط) and `dhofar` (ظفار); cities `seeb` (السيب), `bawshar` (بوشر), `muttrah` (مطرح), `salalah` (صلالة); neighbourhoods such as `qurum` (القرم), `al-khuwair` (الخوير), `bausher` (بوشر). Header line in every file (exact, from the decision file): `area_level,area,property_type,metric,value,period_start,period_type,source_url,source_note,confidence`. Shape the numbers and notes like NCSI and MOHUP (quarterly residential land, villa and apartment indices are out of scope, so use OMR prices, monthly transaction counts, yields). Figures are made up, so every file name starts `market-stats-` and every `source_note` says "TEST FIXTURE — not real data" (so nobody imports one to production by mistake).

1. `market-stats-official-good.csv` — 12 valid rows, UTF-8: NCSI-shaped governorate rows for muscat and dhofar (average sale price, average rent, price per sqm, for APARTMENT, VILLA and a blank type), two MOHUP-shaped city rows (seeb, salalah) with `transactionCount`, a `period_type` of `quarter` on two rows, one row with `confidence` set, one blank. Expected: 12 figures in a handful of groups, no problems.
2. `market-stats-official-bad-header.csv` — the header has `vaule` instead of `value` and no `source_url` column, and has an extra column `notes`. Expected: "Column value is missing", "Column source_url is missing", warning "Column notes is not used"; nothing importable.
3. `market-stats-official-arabic-names.csv` — the same rows as file 1 but with `area` written as Arabic names (`مسقط`, `ظفار`, `السيب`, `صلالة`), including two rows using the slug, and one city row `bawshar` written as `بوشر` at level `city` next to a neighbourhood row written as `بوشر` at level `neighborhood` — the clash case (the neighbourhood row is expected to be rejected as not allowed unless the box is ticked; with the box ticked both resolve to different places). UTF-8 with byte-order mark.
4. `market-stats-official-mixed-digits.csv` — the same figures as file 1 with values and dates in Arabic-Indic digits (`٣٤٥٫٥٠٠`), Eastern Arabic-Indic digits (`۱۲۳٫۵`), Latin digits, and one value mixing scripts (`١٢3.٥`), and one thousands-separated value in quotes (`"1,250"`). Expected: identical numbers to the Latin-digit version.
5. `market-stats-official-neighborhood-row.csv` — five valid governorate or city rows plus two `neighborhood` rows (`qurum`, `al-khuwair`) with a real-looking official `source_url`. Expected: the two neighbourhood rows rejected with `neighborhoodNotAllowed` when the box is not ticked; all seven accepted when it is.
6. `market-stats-official-mixed-errors.csv` — one row for each error code the parser can raise (blank `area`, unknown level `district`, place not found `Musandam`, ambiguous is covered in the parser's own unit test with an invented directory rather than here, bad property type `FLAT`, unknown metric `avgPrice`, `value` = `abc`, a negative value, 4 decimal places, `period_start` = `2026-01-15`, bad `period_type`, `source_url` without `https://`, `confidence` = 1.5, a `source_note` over 500 characters, a repeated row, and two rows for the same place/type/month with different source links). The file must have the expected error and its line number recorded in a comment file `market-stats-official-mixed-errors.expected.txt` (one line per error: line, column, code) — the parser test reads it.
7. `market-stats-official-formula.csv` — three otherwise valid rows where `source_note` is `=HYPERLINK("http://example.com","x")`, `+1+1` and `@SUM(A1)`. Expected: imports fine, cells kept as plain text.
8. `market-stats-official-semicolons.csv` — a good file but separated with semicolons. Expected: `wrongDelimiter`.
9. `market-stats-official-empty.csv` — header only. Expected: `empty`.
10. `market-stats-agency-good.csv` — 8 valid rows in the agency style (city and neighbourhood level, source links pointing at an agency's own site, `confidence` column present and ignored). Expected: all 8 accepted in agency mode, saved as user-submitted with confidence 0.5.
11. `market-stats-agency-too-many.csv` — 101 valid rows (for the 100-row agency cap; generate by script or by hand in a loop, deterministic). Expected: refused with `tooManyRows`.

The 500 KB / 2,001-row refusals are tested by the test itself building a string in memory — no fixture file needed.

## Open questions (max 3, each with my suggested default)

1. **National-level rows.** The decision file's level rules mention national figures (NCSI totals, CBO), but its fixed `area_level` column only allows governorate, city or neighborhood. Should the file accept `national`? Default: NO — keep the columns exactly as fixed in v1; national figures continue to be entered with the existing single-row form (it already supports "whole country"). If the owner wants it, it is a two-line addition to the parser (`area_level=national`, `area` left blank).
2. **One bad row: block the whole file, or import the good rows?** Default: block the whole file until every row is clean (nothing half-loaded; a re-upload is safe and idempotent). The alternative — import only the good rows and download an error list — is friendlier for very large files but leaves half-loaded data.
3. **Agency rules.** Three defaults to confirm together: (a) agencies must give a source link on every row, same as the official file (an agency with no public source can point to its own site or a report); (b) agencies may upload neighbourhood-level figures (they are labelled "User submitted", reviewed by the owner one at a time, and never marked official); (c) only approved agencies may upload. Default: yes to all three.

Also flagged for the owner (not a question): Build D is an addition to the plan's three builds — without it official governorate figures are stored but no visitor can see them; and there is no native-speaker review of the Arabic strings yet.
