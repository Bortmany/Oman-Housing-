# Align 5 — Price map, "search this area", and saved-search alert emails

- **App:** Oman Property Intelligence (`Oman-Housing-`) · **Round:** alignment, October 2026 · **Plan step:** Step 5 (owner-approved in the plan; spec approval is the Sitting 1 gate)
- **Written:** 30 Sep 2026 by product-manager. Built by three parallel builders (A, B, C) — see "Builder briefs".
- **Backlog rows matched:** none found (backlog not opened for this round; the owner's decision table in `Agents/docs/visions/oman-property.md` rows "Saved searches — alerts actually send" and "Maps — coloured price-per-area map, and search by moving the map" are the source).

## What I could and could not check

Checked in this worktree's code (all facts below were read, not assumed):
- `src/components/map/PropertyMap.tsx` — MapLibre, imported lazily inside an effect, raster tiles from `NEXT_PUBLIC_MAP_TILE_URL` (default OpenStreetMap), wrapped `dir="ltr"`. Its effect re-creates the whole map whenever the `pins` array changes.
- `src/app/[locale]/(public)/market/page.tsx` — no map today; uses `latestStatsByNeighborhood(type)` (cached 5 min, one latest row per neighbourhood that HAS a stat, so neighbourhoods with no row at all are simply absent).
- `src/app/[locale]/(public)/properties/page.tsx` — reads filters straight out of the URL; the map is only drawn when at least one result has coordinates, and is hidden entirely when there are zero results. `searchListings` caps at 60, ACTIVE only, newest first.
- `src/lib/savedSearch.ts` — `SEARCH_PARAMS` is the whitelist; `normalizeSearchQuery` drops anything else. `SavedSearch` has `frequency` ("instant" | "daily") but no last-alert memory. Nothing sends email yet.
- `src/lib/email/send.ts` — Resend wrapper that reports "not-configured" without `RESEND_API_KEY` + `EMAIL_FROM`; no caller uses it yet.
- `next.config.ts` — the CSP already derives the tile origin from `NEXT_PUBLIC_MAP_TILE_URL`.
- `Neighborhood.lat/lng` exist (nullable Float); `Property.lat/lng` exist (nullable Float).
- `src/lib/chartPalette.ts` — only 4 categorical colours; there is NO 5-step sequential scale yet.
- `/api/images/[...path]` only serves `.jpg/.png/.webp`, so files in `DATA_DIR/outbox/` (`.eml`) cannot be fetched through it.

NOT possible to check:
- **`docs/decisions/ads-stats-and-services.md` did not exist in this worktree when the spec was first written.** The owner has since chosen Protomaps for map tiles (30 Sep 2026); see A8. The raster path stays as the fallback.
- **Steps 1 and 3 are not in this branch** (no `isSample` column, no `LISTING_DERIVED` provenance value in `prisma/schema.prisma`). The price map's "weakest source" and "Sample data" note need both. Dev-lead must merge Steps 1 and 3 before Build A starts (the plan orders them earlier); the spec below names the fields as the plan defines them.
- **Mobbin was not reachable in this session**, so there are no `mobbin_url` citations. Comparable flows the ui-designer should pull from Mobbin before designing: Airbnb ("Search as I move the map"), Zillow ("Search this area" / price heat map), Bayut or Property Finder (map search + saved-search alerts), Zoopla or Rightmove (saved-search alert emails). I have not invented links.

## Standards note (Agents/docs/engineering-standards.md sections 6–8)

| Question | Answer |
|---|---|
| Collects new personal data? (privacy page must change in the same build) | **Yes — modestly.** (1) Alert emails are sent to the user's existing account address and an `AlertLog` row records who/which search/how many/result (no email body stored). (2) The email provider (Resend) receives the address and email content. (3) Saved searches now also store a map area (not personal). Build C must update the privacy page in the same change, EN + AR (exact text in C7). The map tile server seeing a visitor's IP is an existing gap (privacy page never mentions maps); C closes it with one sentence while it is in there. |
| Touches the core guarantee (provenance labels + the AI leash)? (must have a test) | **Yes, twice.** The price-map legend must show the weakest source among the figures drawn (Build A test), and alert emails show prices and their source label and never include sample listings (Build C test). Both tests run inside `npm run verify`. |
| Adds mutations or external calls? (rate limiting) | **Yes.** The job route sends email through Resend (external). Limits are named in C4: secret required, failed-secret attempts limited per IP, a hard cap per run, a cap per user per 24 h, at most one email per search per run. Map-move search is a plain page load (no new mutation); saving a search keeps its existing limit (30/min/user, 25 searches/user). |
| Backups (§8) | Outbox files are dev-only test artefacts on the `/data` volume, not a record to back up; `AlertLog` lives in the database and is covered by the database backup. Say so in GO-LIVE (C6). |

## The problem, in the owner's words

"The map shows where prices are high or low and searches as you move it; saved searches actually send email." Today the map only pins the current results, a visitor cannot see at a glance which areas are expensive, and someone who saves a search is told "email alerts start once the email service is connected" — nothing is ever sent.

## Builder briefs — file ownership (no two builders edit the same file)

Shared-seam rule: **B lands a small "seam" commit first** (B1) because C needs it. C starts with everything that does not need the seam (migration, template, guard, outbox) and rebases onto B's seam before wiring the search. A is independent.

New top-level message namespaces so the three never touch the same JSON block: A = `priceMap`, B = `searchMap`, C = `alertEmail` (+ edits to existing `savedSearches` and `legal.privacy`). All strings in BOTH `messages/en.json` and `messages/ar.json` in the same commit (house rule 3).

| File | Owner |
|---|---|
| `src/components/map/PriceMap.tsx` (new), `src/components/map/mapStyle.ts` (new, shared, see A8), `src/lib/priceMap.ts` + `src/lib/priceMap.test.ts` (new), `src/lib/db/price-map.ts` (new), `src/lib/chartPalette.ts` (add scale only), `src/app/[locale]/(public)/market/page.tsx`, `src/app/[locale]/(public)/market/loading.tsx`, `next.config.ts` (CSP, A8 only), `public/map/*` (self-hosted fonts and sprites, A8), `package.json` dependencies (`pmtiles`, Protomaps style package; A8), GO-LIVE.md "map tile server" bullets | **A** |
| `src/components/map/PropertyMap.tsx`, `src/components/marketplace/{PropertyFilters,AppliedFilters}.tsx`, `src/app/[locale]/(public)/properties/page.tsx`, `properties/loading.tsx`, `src/lib/savedSearch.ts` + `savedSearch.test.ts` (extend existing), `src/lib/searchFilters.ts` (new), `src/lib/db/listings.ts`, `src/app/[locale]/(app)/account/actions.ts` (name of a saved search only) | **B** |
| `prisma/schema.prisma` + new migration folder, `src/app/api/jobs/saved-search-alerts/route.ts` (new), `src/lib/alerts/*` (new: runner, template, tests), `src/lib/email/send.ts`, `src/lib/db/saved-searches.ts`, `src/components/marketplace/SaveSearchButton.tsx`, `src/app/[locale]/(app)/account/page.tsx`, `src/app/api/health/route.ts`, privacy page strings + `privacy/page.tsx`, GO-LIVE.md "Email" section + new "Alert job" section, `docs/CONVENTIONS.md` and `.env.example` (all env-var lines for A, B and C), `package.json` `test:unit` list | **C** |

A test file added by A or C is appended to `test:unit` by C at merge (B extends the existing `savedSearch.test.ts`, so needs no package.json change). Dev-lead: merge order B-seam → C → A → B-rest is easiest; none of A's files overlap.

---

# Build A — Price map on /market

## A1. What the visitor sees and does

**Laptop (1280px), `/en/market` and `/ar/market`:** below the Apartments/Villas tabs and above the price-trend chart, a new card:
1. Heading "Price per square metre, by area" and one sentence of help (strings below).
2. A map (height about 28rem) with one coloured circle per neighbourhood that has coordinates. Colour = average price per sqm on a 5-step scale (light = cheaper, dark = dearer); circle size = the sample size behind the figure. Neighbourhoods with coordinates but NO price per sqm (either no stat row at all, or a row where the figure is empty) show as a small grey hollow circle, labelled "No data" in the legend and popup.
3. Clicking a circle opens a small popup: area name, "{OMR value} per sqm", "Sample size: N", month of the figure, and a link "View area" to `/market/<slug>`. (Plan says "click → neighbourhood page"; on a phone a direct jump on every accidental tap is annoying, so the popup link is the route. See open question 1.)
4. **Legend, directly under the map, OUTSIDE the `dir="ltr"` box** so it mirrors in Arabic: five colour swatches, each with its numeric range ("OMR 850 – 1,050"), a grey swatch "No data", the size key, and "Weakest source shown on this map:" followed by the existing `ProvenanceBadge` of the weakest input (A3). While every drawn figure is sample data the legend badge reads the Step 1 "Sample data / بيانات تجريبية" label and an extra sentence appears (A5).
5. The map follows the Apartments/Villas tab already in the URL.
6. The existing neighbourhood cards stay; they are the text equivalent of the map.

**Phone (390px):** same card, map about 18rem tall, legend swatches wrap into two rows, popup link is a full-height tap target (min 44px). Page scrolling must not get stuck on the map: use MapLibre's `cooperativeGestures` (two fingers to move on touch, Ctrl + scroll on desktop) with the strings in A5. No horizontal scroll at 390px in either language.

**States:** loading = grey box of the same height with "Loading map…" (no layout jump); map fails to load (blocked tiles/offline) = the box is replaced by "The map could not load. The figures are listed below."; areas with figures but no coordinates = one line "{count} areas have figures but no map position yet — see the cards below."; no market data at all = the page's existing "no data" card, no map.

## A2. Data and code shape

- A new cached query in `src/lib/db/price-map.ts`: all neighbourhoods with `id, slug, nameEn, nameAr, lat, lng` (cached like the market queries, same `MARKET_DATA_CACHE_TAG` so an admin save refreshes it) merged in code with `latestStatsByNeighborhood(type)`. `latestStatsByNeighborhood` is left untouched.
- A pure module `src/lib/priceMap.ts` (no I/O) builds the points: `bucketFor(value, breaks)`, `radiusFor(sampleSize)`, `weakestInput(rows)`, `buildBreaks(values)`. Breaks: five equal-count groups (quintiles) computed from the values on screen, so it works with sample data and real data alike; with fewer than 5 distinct values, use as many steps as there are values (never draw a step no circle uses). Radius: between 12px and 28px, square-root of sample size; missing sample size = 12px. All money through `formatOMRWhole` (house rule 2); Decimal converted to string/number before it reaches the client component.
- **Colour scale:** add a 5-step sequential `PRICE_SCALE` to `src/lib/chartPalette.ts`, same file conventions as `CHART_COLORS` (validated, fixed order). Starting suggestion: Tailwind teal 200/400/600/800/950 (`#99f6e4 #2dd4bf #0d9488 #115e59 #042f2e`); builder verifies adjacent steps are distinguishable, each circle keeps a 1.5px white outline plus a thin dark ring so pale steps stay visible on light tiles, and that a colour-blind simulation still orders them. One scale for light and dark UI because the map keeps its light tiles in dark mode (as `PropertyMap` already notes); legend swatches carry the same outline. Grey "no data" = stone-400 (`#a8a29e`) outline, 30% fill, distinguishable from the palest step.
- Colour is never the only signal: the legend prints the numeric ranges, and the popup/cards print the figure.
- Popup HTML is raw HTML: every dynamic string through `escapeHtml` (as `PropertyMap` does); wrap the popup body in `dir="rtl"`/`dir="ltr"` matching the page locale, because the map container is forced LTR.

## A3. "Weakest source" (core guarantee)

The legend badge shows the WEAKEST provenance among the stat rows that produced a coloured circle (grey "no data" circles have no figure, so they do not count). Weakest-first order: **Sample data** (Step 1 `isSample`) < `AI_ESTIMATED` < `USER_SUBMITTED` < `LISTING_DERIVED` (Step 3) < `OFFICIAL_STAT` < `VERIFIED`. Ties: show the lowest confidence among the tied rows. The badge component is the existing `ProvenanceBadge`, never a new one. Never label a map "official" or "verified" unless every drawn figure is (house rule 1).

## A4. Lazy loading

MapLibre is imported inside the client component's effect, exactly as `PropertyMap` does, so `/market` ships no map code in its first page load. Acceptance: with the network panel open, no `maplibre` chunk or tile request appears until the market page has rendered; the map card reserves its height. A `loading.tsx` skeleton entry for the card (standards §9).

## A5. Exact strings — namespace `priceMap`

| Key | EN | AR |
|---|---|---|
| title | Price per square metre, by area | السعر للمتر المربع، حسب المنطقة |
| subtitle | Each circle is one neighbourhood. Colour shows the price per square metre; a bigger circle means more data behind it. | كل دائرة تمثل حيًا واحدًا. اللون يبيّن السعر للمتر المربع، والدائرة الأكبر تعني بيانات أكثر خلفها. |
| mapLabel | Map of average price per square metre by neighbourhood. The same figures are listed in the cards below. | خريطة متوسط السعر للمتر المربع حسب الحي. الأرقام نفسها مدرجة في البطاقات أدناه. |
| legendTitle | Price per square metre | السعر للمتر المربع |
| noData | No data | لا توجد بيانات |
| noDataHint | No price per square metre recorded for this area yet. | لم يُسجَّل سعر للمتر المربع لهذه المنطقة بعد. |
| sizeKey | Bigger circle = larger sample | الدائرة الأكبر = عينة أكبر |
| sourceLabel | Weakest source shown on this map: | أضعف مصدر معروض على هذه الخريطة: |
| latestNote | Each area shows its latest recorded month. | تعرض كل منطقة أحدث شهر مسجَّل لها. |
| sampleNote | This map currently shows sample data only — not real market prices. | تعرض هذه الخريطة حاليًا بيانات تجريبية فقط، وليست أسعار السوق الحقيقية. |
| unplaced | {count} areas have figures but no map position yet — see the cards below. | {count} من المناطق لها أرقام لكن بلا موقع على الخريطة بعد — راجع البطاقات أدناه. |
| popupPrice | {value} per sqm | {value} للمتر المربع |
| popupSample | Sample size: {count} | حجم العينة: {count} |
| popupOpen | View area | عرض المنطقة |
| loading | Loading map… | جارٍ تحميل الخريطة… |
| mapFailed | The map could not load. The figures are listed below. | تعذّر تحميل الخريطة. الأرقام مدرجة أدناه. |
| gestureTouch | Use two fingers to move the map | استخدم إصبعين لتحريك الخريطة |
| gestureScroll | Use Ctrl + scroll to zoom the map | استخدم Ctrl مع التمرير لتكبير الخريطة |

Arabic digits: the page uses Latin digits in Arabic UI (house rule 2) — values come from `formatOMRWhole`, counts must stay Latin too. The "Sample data / بيانات تجريبية" badge text comes from Step 1's own message key, not a new string.

## A6. Tile provider and GO-LIVE

- Keep `NEXT_PUBLIC_MAP_TILE_URL` (already read by the map and by the CSP) as the fallback raster source. **The production provider is now Protomaps; the full setup is in A8**, which supersedes the earlier "provider not chosen" and "raster only" wording. A writes the production steps into GO-LIVE.md "Swap the map tile server" as described in A8.
- Provider licences usually require visible attribution. Add optional `NEXT_PUBLIC_MAP_ATTRIBUTION` (default "© OpenStreetMap contributors", today's hard-coded text) read by `PriceMap`; B reads it in `PropertyMap` too (one line each — deliberate duplication so A and B stay independent). C documents it in `.env.example` and `CONVENTIONS.md`. (When PMTiles is in use, A8's attribution text takes over.)
- Verify the CSP against a RUNNING dev server (standards §6): tiles load on `/en/market` with no CSP errors in the console, before and after changing the tile URL to a second host.
- The raster fallback keeps using a plain single-host raster URL (`{z}/{x}/{y}`).

## A7. Acceptance checks (Build A)

1. `/ar/market` at 1280px: coloured map card, legend directly under it, and the legend's first swatch is on the RIGHT (mirrored) while the map itself is unchanged; `/en/market` mirrored the other way.
2. While only sample data exists, the legend badge reads "Sample data / بيانات تجريبية" and the sample note shows, in both languages.
3. Every neighbourhood with a price per sqm is coloured; one with coordinates and no figure is grey and says "No data"; a neighbourhood without coordinates is not drawn and is counted in the "unplaced" line.
4. Click a circle: popup with name, figure, sample size, month, and a link that opens `/market/<slug>` (locale kept).
5. Switching to Villas redraws the map from villa figures.
6. 390px in both languages: no sideways scroll, legend readable, map does not trap page scrolling (drag with one finger scrolls the page; two fingers move the map; the hint text shows).
7. Before the page has loaded, no map code is requested (lazy). Blocking tile requests shows the "could not load" message and the cards still work.
8. Unit tests (`priceMap.test.ts`): weakest-source order incl. sample and ties; a map with one sample row shows Sample as weakest even if 10 rows are official; quintile breaks with 3 values; radius floor/ceiling; a row with null price is grey and excluded from the weakest-source calculation.
9. Dark mode: card frame follows theme; legend text readable; map tiles stay light.

## A8. Map tiles: Protomaps (owner decision, 30 Sep 2026)

**The owner chose Protomaps** (a self-hosted vector map file). **Owned by Build A**, because A owns the GO-LIVE map-tile bullets and is independent of B and C. A creates ONE shared helper, `src/components/map/mapStyle.ts` (new; builds the MapLibre style from the env vars below, given the locale), and uses it in `PriceMap`. `PropertyMap.tsx` belongs to B, so B adopts the helper there in "B-rest" (after A in the merge order; one small swap, no other change to `PropertyMap`). Until B adopts it, `/properties` and the property detail page keep the old raster path unchanged, which is safe. A also owns the `next.config.ts` CSP edit and adds the `pmtiles` and Protomaps style package lines to `package.json` dependencies (C still owns the `test:unit` list; A hands C any new test file name as usual).

What A builds:
- **Packages and protocol.** Add the `pmtiles` package and register its protocol with MapLibre once, on first map creation, inside the same lazy import as MapLibre (so `/market` still ships no map code up front, A4). Style comes from the Protomaps base-style package (npm `protomaps-themes-base` at time of writing; the builder checks the current package name and version on npm and notes it in the commit if it has moved). Use the light flavour only (tiles stay light in dark mode, A2). Label language: `lang: "ar"` on `/ar`, `lang: "en"` on `/en`.
- **New env `NEXT_PUBLIC_MAP_PMTILES_URL`** (full URL of the `.pmtiles` file). **When unset, the map falls back to today's raster `NEXT_PUBLIC_MAP_TILE_URL` path, unchanged**, so local development needs no setup. When set, it wins over the raster URL.
- **Fonts and icons self-hosted.** Glyph (font) files and sprites are served from the app's own origin (under `/public`, e.g. `/map/fonts/...` and `/map/sprites/...`), fetched by the builder and committed, with the fonts' licence text alongside. No new `font-src` and no third-party font host. Arabic letters must be covered (the builder confirms the chosen font set includes Arabic glyphs).
- **CSP (`next.config.ts`).** `connect-src` gains the PMTiles origin, derived from `NEXT_PUBLIC_MAP_PMTILES_URL` the same way the raster tile origin is derived today (a small origin function next to `tileOrigin`); nothing is added when the variable is unset. Glyphs and sprites are same origin, so nothing else changes. Verify against a RUNNING dev server (standards §6): no CSP errors in the console with the variable unset, and none with it set to a test file on a second host.
- **Attribution.** When PMTiles is used the attribution reads "Protomaps © OpenStreetMap" (with the usual links). When it is not used, today's text (or `NEXT_PUBLIC_MAP_ATTRIBUTION` from A6) stays. Same text on EN and AR pages (proper names).
- **GO-LIVE.md owner steps** (A rewrites its "Swap the map tile server" bullet): (1) create a Cloudflare R2 bucket and attach a custom domain to it (for example `tiles.<your domain>`); (2) set the bucket CORS to allow GET and HEAD from the site's origin, allow the `Range` request header, and expose the `ETag` header; (3) cut an Oman extract from the Protomaps world build with the `pmtiles extract` command, bounding box about `51.5,16.4,60.0,26.5` (west, south, east, north); (4) upload the file to the bucket; (5) set `NEXT_PUBLIC_MAP_PMTILES_URL` to the file's public address and redeploy (it is a build-time variable). Also note: refresh the file a few times a year. C lists the new variable in `.env.example` and `CONVENTIONS.md` (added to C6's list).
- **Standards note for this change.** No new personal data beyond the IP-visibility sentence already in C7 (the tile file is fetched from the owner's own Cloudflare domain; the wording "third-party map server" stays accurate because Cloudflare hosts it). No new mutations. The external call is a read-only file fetch from the owner's own bucket; no app-side rate limiting needed (Cloudflare fronts it). Core guarantee untouched.

Acceptance (A8):
1. With `NEXT_PUBLIC_MAP_PMTILES_URL` unset, `/en/market` and `/ar/market` look exactly as they do today (same raster tiles, same attribution), with no requests to any Protomaps address and no CSP errors.
2. With it set to a local test `.pmtiles` file (the builder may generate a tiny extract, or use a public Protomaps demo file for local testing only; never committed and never referenced in GO-LIVE as production), the map draws vector tiles, attribution reads "Protomaps © OpenStreetMap", and **Arabic place names appear on `/ar/market`** while `/en/market` shows English names.
3. Fonts and sprites load from the app's own origin (network panel: no request to a third-party font host); the CSP header differs from before only by the extra `connect-src` origin.
4. A tiny extract may not cover all of Oman; the check is that names appear, not full coverage.

---

# Build B — Search by moving the map on /properties

## B1. The seam commit (land first; C depends on it)

- `src/lib/searchFilters.ts` (new, pure): `parseSearchFilters(params: Record<string,string|undefined> | URLSearchParams): SearchFilters` — the validation now inline in `properties/page.tsx` (property types, ownership, numbers ≥ 0, listing type) moved here, plus the map bounds. The page and (later) the alert job both call it, so a saved search means exactly the same thing in both places.
- `SearchFilters` in `src/lib/db/listings.ts` gains `bounds?: { n: number; s: number; e: number; w: number }` and `publishedAfter?: Date` (+ optional `publishedUntil?: Date`, `limit?: number`, default stays 60) for C.
- `SEARCH_PARAMS` in `src/lib/savedSearch.ts` gains `"n","s","e","w"`. `normalizeSearchQuery` treats the four as one unit: all four present and valid, or all four dropped.
- `searchListings` bounds filter: `property.lat` between s and n, `property.lng` between w and e (properties with no coordinates are excluded when bounds are set). Still ACTIVE-only.

## B2. Bounds rules

- URL: `?n=23.65&s=23.55&e=58.55&w=58.30` — decimal degrees, rounded to 4 places when written (about 11 m).
- Valid = all four finite; −90 ≤ s < n ≤ 90; −180 ≤ w < e ≤ 180. Anything else (including a box that crosses the antimeridian, irrelevant for Oman) = ignore all four, show normal results. Never trust the raw URL (standards §1); the saved query stores only the cleaned values (≤ 64 chars each, so `normalizeSearchQuery`'s limit is fine).
- Bounds AND the other filters both apply. Pressing "Search this area" removes `hood` from the URL (the map area replaces the neighbourhood choice; keeping both confuses people); every other filter stays.

## B3. What the visitor sees and does

**Laptop and phone, `/properties`:**
1. The map is shown whenever there are pins OR a map area is set (today it vanishes when there are zero results; with map search that would strand the user). With no pins and no area, keep today's rule (no map at all) unless the seed/real data has any coordinates — builder checks; default centre if a map must be drawn with nothing: Muscat (23.588, 58.383), zoom 10.
2. Initial view: fits all result pins; if a map area is in the URL, opens on exactly that area.
3. The visitor drags or zooms. **Nothing reloads.** After a user-made move (not the map's own first fit), a button appears in the page flow directly above the map, OUTSIDE the LTR map so it mirrors: **"Search this area / ابحث في هذه المنطقة"** with the small hint "You moved the map. Press the button to see listings in this area." It never fires by itself on drag (owner rule).
4. Pressing it updates the URL with `n,s,e,w` (client navigation through `@/i18n/navigation`, `scroll: false` so the page does not jump), the results list and count refresh, pins refresh, the map stays where the user left it (no re-fit), the button hides.
5. A chip "Map area ×" joins the existing applied-filter chips; the × removes the four bounds together and keeps other filters.
6. Below the results count while an area is set: "{count} listings in this map area". Zero results: "No listings in this map area." + hint; the map stays visible so they can move on.
7. Small note under the map while an area is set: "Listings without a map location are not included when you search a map area."; when 60 results are returned: "Showing the newest 60. Zoom in to narrow down."
8. The filter form (`PropertyFilters`) is a plain GET form: it must carry the current `n,s,e,w` as hidden inputs so applying a filter does NOT silently drop the map area. "Clear" removes them.
9. Pins: tap/click opens the popup (title, price via `formatOMRWhole`, link to the listing); popup body gets `dir` matching the page locale (the map box is forced LTR).
10. **Save this search** keeps the area: the saved query includes `n,s,e,w`; the saved name gets a "Map area" part (edit `describeSearch` in `account/actions.ts`); a line near the button "This search includes the current map area."; opening it from the account page restores the exact area (works via `searchQueryToObject` because the params are whitelisted).
11. Phone: map about 18rem, button full width, min 44px tall, placed above the map; `cooperativeGestures` on (same two strings as A); no sideways scroll; chip row wraps.

## B4. Code notes

- `PropertyMap.tsx` is also used on the property detail page: extend it additively (optional props such as `onUserMove`, `initialBounds`, `fitToPins`); its default behaviour must not change.
- **Trap:** its effect rebuilds the whole map whenever `pins` (or centre) changes identity. In the interactive version a parent state update on every move must NOT recreate the map. Keep the map instance stable and update markers separately.
- Pin popups are raw HTML — keep `escapeHtml`.
- In B-rest (after A merges), switch `PropertyMap` to build its map style through A's shared `mapStyle.ts` helper (A8), so the Protomaps vector tiles and Arabic labels apply on `/properties` and the detail page too. With `NEXT_PUBLIC_MAP_PMTILES_URL` unset the result must be identical to today.

## B5. Exact strings — namespace `searchMap`

| Key | EN | AR |
|---|---|---|
| searchThisArea | Search this area | ابحث في هذه المنطقة |
| movedHint | You moved the map. Press the button to see listings in this area. | حرّكت الخريطة. اضغط الزر لعرض الإعلانات في هذه المنطقة. |
| areaChip | Map area | منطقة الخريطة |
| removeArea | Remove map area | إزالة منطقة الخريطة |
| inArea | {count} listings in this map area | {count} إعلان في منطقة الخريطة هذه |
| noneInArea | No listings in this map area. | لا توجد إعلانات في منطقة الخريطة هذه. |
| noneInAreaHint | Zoom out or move the map, then press “Search this area” again. | صغّر الخريطة أو حرّكها ثم اضغط «ابحث في هذه المنطقة» مرة أخرى. |
| noLocationNote | Listings without a map location are not included when you search a map area. | الإعلانات التي بلا موقع على الخريطة لا تظهر عند البحث في منطقة الخريطة. |
| capNote | Showing the newest 60. Zoom in to narrow down. | نعرض أحدث 60 إعلانًا. قرّب الخريطة لتضييق النتائج. |
| mapLabel | Map of listings. Drag or zoom, then press “Search this area”. | خريطة الإعلانات. اسحب أو غيّر التكبير ثم اضغط «ابحث في هذه المنطقة». |
| savedIncludesArea | This search includes the current map area. | يتضمن هذا البحث منطقة الخريطة الحالية. |
| mapFailed | The map could not load. The listings are shown below. | تعذّر تحميل الخريطة. الإعلانات معروضة أدناه. |
| gestureTouch / gestureScroll | (same text as `priceMap` — B copies the two strings into its own namespace) | (same) |

## B6. Acceptance checks (Build B)

1. On `/en/properties`, drag the map: URL and results do not change; the "Search this area" button appears. Press it: URL gains `n,s,e,w`, results and count change, map stays put, button hides. Repeat on `/ar/properties` with the Arabic label; the button and hint are on the right side of the page (mirrored).
2. Zooming or panning alone never triggers a navigation (watch the network tab).
3. Hand-edited URLs (`n=abc`, `s>n`, only two of four, `n=999`) show normal unfiltered results and never appear in a saved search or chip.
4. With a map area set, apply the type filter: the area is kept. Remove the area chip: other filters stay.
5. Save the search while an area is set; the account page link reopens the same area.
6. A listing with no coordinates never appears in an area search; the note says so.
7. Zero results in an area: map still visible, message + hint shown.
8. Property detail page map still works exactly as before.
9. 390px both languages: button ≥ 44px, no sideways scroll, page scroll not trapped by the map.
10. Tests (extend `savedSearch.test.ts`, add `searchFilters` cases): valid/invalid bounds, all-or-nothing rule, rounding, `hood` dropped on area search helper, `parseSearchFilters` parity with the old inline rules.

---

# Build C — Saved-search alert emails

## C1. What the user sees

- **Account page (`/account`):** the saved-searches note changes from "We save the search now. Email alerts start working once the site's email service is connected." to the real state. When email is live (or in outbox test mode): "We email you when new listings match a saved search — as soon as they appear, or once a day, as you chose." When email is not connected: the existing sentence stays, unchanged (it is still true). Each saved search also shows "Last alert: {date}" or "No alert sent yet". Deleting a saved search is the unsubscribe (no new screen).
- **`SaveSearchButton`:** its small note follows the same live / not-connected split.
- **The email** (below), sent in the user's own `User.locale` ("en" or "ar").

## C2. The email

- **Subject:** "New listings for “{name}”" / "إعلانات جديدة لبحثك «{name}»".
- **Body (plain text ALWAYS, HTML too):** greeting; intro; "New since your last alert: N"; up to **5** listings, each with title (`localName` for the user's locale), neighbourhood, type/beds, **asking price** via `formatOMRWhole` (rent adds "per month/per year"), the price's **source label** (the listing's provenance, using the existing `provenance.*` strings), and a link to the listing; if more than 5, "…and N more" plus a "See all matches" link to `/properties?<saved query>` in the same locale; footer with why they got it, the account-page link to stop or change it, and the honesty line "Prices are asking prices set by the advertiser, not valuations."
- **Links** are absolute, built from `AUTH_URL` + `/{locale}/…`; a listing link goes to `/properties/<propertyId>` (that is the app's listing-page address, verified from `ListingCard` usage and the account page).
- **Arabic HTML:** `<html lang="ar" dir="rtl">`, `dir="rtl"` on the wrapper and every table, all styles inline (email clients drop `<style>`). Email HTML is the one place logical CSS is unavailable, so direction comes from the `dir` attribute, not `left/right` styles. Latin digits. Every dynamic value through `escapeHtml`. English uses `dir="ltr"`. Subject and preheader use RFC-safe encoding for Arabic.
- **Never included:** sample listings (skip any listing with Step 1 `isSample = true`), non-ACTIVE listings, other users' data.
- Template is a pure function `buildAlertEmail({ locale, name, listings, totalNew, baseUrl, query })` in `src/lib/alerts/template.ts`, returning `{ subject, text, html }`; copy comes from the `alertEmail` namespace via `getTranslations({ locale, namespace })`.

## C3. Data (additive, real migration — house rule 11)

- `SavedSearch.lastAlertedAt DateTime?` — when the last alert for this search was CLAIMED/sent; null = never.
- `SavedSearch.lastMatchedListingId String?` — newest listing included in the last alert (plain text, no relation, so deleting a listing never blocks anything).
- New table `AlertLog`: `id`, `userId` (deleted with the account), `savedSearchId` (kept as plain text; the log survives if the search is deleted), `frequency`, `matchedCount`, `status` (text validated in code, like `frequency`: `claimed`, `sent`, `failed`, `not-configured`, `skipped`), `reason` (short code such as `http_429`, never an email address or body), `createdAt`. Indexes on `(savedSearchId, createdAt)` and `(userId, createdAt)`. No email addresses stored in it.
- Migration created with `npx prisma migrate dev --name saved-search-alerts`, folder committed, no `db push`, no drops or renames; existing saved searches get null and start alerting from their own `createdAt` (they never receive the back-catalogue).
- `AlertLog` rows older than 90 days are deleted by the same job (state 90 days in the privacy retention text).

## C4. The job route — `POST /api/jobs/saved-search-alerts`

- **Guard:** requires header `Authorization: Bearer <CRON_SECRET>` (constant-time comparison). Wrong or missing secret = **401** `{"ok":false}`, nothing else revealed. If `CRON_SECRET` is not set on the server = **503** `{"ok":false,"reason":"not-configured"}` — an unset secret must never mean an open door. Only POST is accepted. Failed-secret attempts are rate limited per IP with the existing `checkRateLimit` (say 20 per minute) before any database work.
- **Email not connected** (no Resend keys and not in outbox test mode): the run does nothing to any search, writes no per-search rows, returns 200 `{"ok":true,"status":"not-configured"}` and logs one line. Searches are NOT marked as alerted, so nothing is lost when the keys arrive later.
- **Which searches are due:** `instant` = every run; `daily` = never alerted, or last alert at least 24 hours ago. Matches = ACTIVE listings that match the saved query (via the shared `parseSearchFilters` + `searchListings`, including the map area) and were published after `lastAlertedAt` (or `createdAt` if never) and up to the run's start time. No matches = nothing happens (no email, no log row, no timestamp change).
- **Idempotent, at most once (the risky part):** for each due search with matches, in ONE database transaction: (1) compare-and-set — update the search only if its `lastAlertedAt` is still the value we read, setting it to the run's start time and `lastMatchedListingId` to the newest match; if zero rows changed, another run got there first, skip; (2) insert `AlertLog` with `claimed`. Only after the transaction commits is the email sent. Then update the log to `sent`, or on a failed send to `failed` and put `lastAlertedAt` back (again compare-and-set) so the next run retries. A crash between claim and send loses that one email but can never send it twice — deliberate (see open question 3).
- **Limits (standards §2):** at most 1 email per search per run; at most 10 alert emails per user per 24 h (counted from `AlertLog`; extras are left unclaimed for a later run); at most 100 emails per run (extras wait for the next hourly call); each search is processed independently so one failure never stops the rest; per-search errors go to `logger`/Sentry with ids only, never addresses.
- **Response:** `{"ok":true,"mode":"live"|"outbox","checked":N,"due":N,"sent":N,"failed":N,"deferred":N}`.
- **Scheduling:** Railway cron calls it hourly (`curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$AUTH_URL/api/jobs/saved-search-alerts"`); documented in GO-LIVE (C6). The route sits under `/api/`, which the proxy passes straight through (no locale prefix); confirm it is not blocked by the sign-in gate.
- Any code that sets a listing ACTIVE must set `publishedAt` (today both admin paths do; verified). A listing with null `publishedAt` would never alert — note this for the Step 4 owner-listing approval path.

## C5. Sending and the dev outbox (`src/lib/email/send.ts`)

- `sendEmail` gains a third live mode without changing existing behaviour: `EMAIL_DEV_LOG=true` writes the message to `DATA_DIR/outbox/<timestamp>-<searchId>.eml` (one standard multipart file with text + HTML parts, UTF-8, so a double-click opens it in a mail app or a browser-readable viewer) and returns a new result `{ status: "outbox", file }`. File names contain only generated ids and a timestamp, never the user's address or input. **Ignored when `NODE_ENV=production`** so real users are never silently swallowed; outbox wins over Resend when both are set in development so tests never send real mail. `SendResult` stays additive; `isEmailConfigured()` keeps meaning "real provider set"; add a small `emailMode(): "live" | "outbox" | "off"` for the job and the account page.
- Directory created on demand under `dataDir()`; not reachable through `/api/images` (only jpg/png/webp are served).
- Health: signed-in admin `/api/health` integrations gain `email: "configured" | "outbox" | "dormant"` and `alertJob: "configured" | "dormant"` (CRON_SECRET set). Never print the secret.

## C6. GO-LIVE and docs (C owns)

GO-LIVE.md: rewrite the "Email" section to match the code (alerts now exist; the enquiry notification is still a TODO); add "Alert job": set `CRON_SECRET` (long random, e.g. `openssl rand -base64 32`), add the hourly Railway cron with the command above, set `RESEND_API_KEY` + `EMAIL_FROM` (domain verified in Resend), note the Resend plan's daily send limit, `EMAIL_DEV_LOG` is for local testing only, `DATA_DIR/outbox` is throw-away test output and needs no backup, `AlertLog` is in the database backup. `CONVENTIONS.md` deploy env list and `.env.example`: `CRON_SECRET`, `EMAIL_DEV_LOG`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_MAP_ATTRIBUTION`, `NEXT_PUBLIC_MAP_PMTILES_URL` (A8).

## C7. Privacy page (same build, both languages — standards §6)

Edit the existing `legal.privacy.collectSavedSearches` line and the retention line, and refresh "Last updated".

- EN, saved searches: "Saved searches and alerts — the search filters and map area you asked us to remember, how often you want to hear about new matches, and when we last emailed you about them, linked to your account. We email new matches to your account address using our email service provider, and keep a short log (which search, when, how many listings, and whether it was sent — never the email text) for 90 days. Delete a saved search from your account page to stop its emails."
- AR, saved searches: "عمليات البحث المحفوظة والتنبيهات — معايير البحث ومنطقة الخريطة التي طلبت منا تذكّرها، وعدد مرات إبلاغك بالإعلانات الجديدة، ووقت آخر رسالة أرسلناها لك عنها، مرتبطة بحسابك. نرسل الإعلانات الجديدة المطابقة إلى عنوان بريد حسابك عبر مزوّد خدمة البريد الإلكتروني لدينا، ونحتفظ بسجل موجز (أي بحث، ومتى، وكم إعلانًا، وهل أُرسلت الرسالة — دون نص الرسالة) لمدة 90 يومًا. احذف البحث المحفوظ من صفحة حسابك لإيقاف رسائله."
- New sentence (append to `collectTechnical`, EN): "Maps load background tiles from a third-party map server, which can see your device's IP address." AR: "تحمّل الخرائط بلاطات الخلفية من خادم خرائط تابع لجهة خارجية، وقد يرى عنوان IP لجهازك."

## C8. Exact strings

`alertEmail` namespace (used inside the email, per the recipient's locale):

| Key | EN | AR |
|---|---|---|
| subject | New listings for “{name}” | إعلانات جديدة لبحثك «{name}» |
| greeting | Hello {name}, | مرحبًا {name}، |
| greetingNoName | Hello, | مرحبًا، |
| intro | New listings match your saved search “{name}”. | ظهرت إعلانات جديدة تطابق بحثك المحفوظ «{name}». |
| countLine | New since your last alert: {count} | الجديد منذ آخر تنبيه: {count} |
| askingSale | Asking price: {price} | السعر المطلوب: {price} |
| askingRentMonthly | Asking rent: {price} per month | الإيجار المطلوب: {price} شهريًا |
| askingRentAnnual | Asking rent: {price} per year | الإيجار المطلوب: {price} سنويًا |
| source | Source: {label} | المصدر: {label} |
| viewListing | View listing | عرض الإعلان |
| more | …and {count} more. | …و{count} أخرى. |
| seeAll | See all matches | عرض كل النتائج |
| whyYouGotThis | You are receiving this because you saved this search on {appName}. | وصلتك هذه الرسالة لأنك حفظت هذا البحث في {appName}. |
| manage | Stop or change this alert: {url} | لإيقاف هذا التنبيه أو تعديله: {url} |
| manageLink | Manage your saved searches | إدارة عمليات البحث المحفوظة |
| disclaimer | Prices are asking prices set by the advertiser, not valuations. | الأسعار المذكورة هي أسعار يطلبها المعلن وليست تقييمًا. |

`{appName}` = the app's existing `appName` string (Arabic: ذكاء العقارات عُمان).

`savedSearches` namespace (existing; C edits):

| Key | EN | AR |
|---|---|---|
| emailNotLive | (unchanged) We save the search now. Email alerts start working once the site's email service is connected. | (unchanged) نحفظ البحث الآن. تنبيهات البريد الإلكتروني تبدأ بالعمل بعد ربط خدمة البريد بالموقع. |
| emailLive (new) | We email you when new listings match a saved search — as soon as they appear, or once a day, as you chose. | نرسل لك بريدًا إلكترونيًا عند ظهور إعلانات جديدة تطابق بحثًا محفوظًا — فور ظهورها أو مرة يوميًا حسب اختيارك. |
| lastAlert (new) | Last alert: {date} | آخر تنبيه: {date} |
| noAlertYet (new) | No alert sent yet | لم يُرسل أي تنبيه بعد |

## C9. Acceptance checks (Build C)

1. Migration folder exists, `npx prisma migrate deploy` applies cleanly on a fresh database and on one that already has saved searches; nothing dropped.
2. Wrong secret → 401; no header → 401; `CRON_SECRET` unset → 503 (never runs); GET → 405.
3. With the right secret and no email keys and no `EMAIL_DEV_LOG` → 200 `not-configured`, no file, no `lastAlertedAt` change, no log rows.
4. `EMAIL_DEV_LOG=true` (dev): save a search (locale `ar` account), publish/approve a matching listing (or run with a listing published after the search was saved), run the job → exactly ONE `.eml` file in `DATA_DIR/outbox/`, Arabic subject, `dir="rtl"` HTML, plain-text part present, listing price shown with its source label, a link that opens the right page under `/ar/`. Same with an English account → English, `dir="ltr"`.
5. Run the job again immediately → response shows `sent: 0`, no new file (idempotent). A `daily` search is not re-sent within 24 h even after new matches; an `instant` search is sent on the next run that has new matches.
6. Two simultaneous runs (two curls at once) produce one file for one search, not two.
7. A search saved with a map area only emails listings inside that area.
8. Deleting the saved search stops emails; no email is sent for a deleted search, and its log rows remain until 90 days.
9. Sample listings and non-ACTIVE listings never appear in an email.
10. Simulated send failure (`http_500`-style stub): log shows `failed`, `lastAlertedAt` restored, next run retries once and succeeds; the run's other searches still process.
11. Per-user cap: a user with 12 instant searches, all matching, receives 10 emails in 24 h, not 12.
12. Account page and SaveSearchButton show the correct live / not-connected sentence in `/en` and `/ar`; "Last alert" appears after a send; no sideways scroll at 390px.
13. Privacy page (EN + AR) shows the new saved-searches/alerts text and the maps sentence.
14. Tests (in `npm run verify`): template test (both locales, escapes hostile listing titles, always has plain text, includes source label per listing, never sample); runner test on the test database for claim/compare-and-set, no double send on repeat and concurrent runs, restore on failure, per-user cap, daily gate.

---

## What is explicitly OUT of scope

- Choosing a different tile provider (decided: Protomaps, see A8; the vector setup in A8 is in scope); heat-map layers, clustering, drawing shapes, "search near me" / device location (Permissions-Policy forbids geolocation — do not change it).
- Auto-searching while dragging (owner rule: never).
- Map search on the market pages, or price maps for cities/governorates; per-area historical playback.
- SMS/WhatsApp/push alerts; one-click `List-Unsubscribe` headers or unsubscribe links that work without signing in; per-search pause/edit; changing frequency after saving (delete and re-save); alerts for price drops or status changes; digest across searches.
- The enquiry-notification email (`TODO(Phase 5 email)`).
- Password reset, email verification of the address.
- Creating Resend, Railway-cron, Cloudflare or map-provider accounts (owner steps in GO-LIVE).
- Rate-limit store changes (still per-process; Redis stays a later switch).

## Bilingual notes (one place)

- Every string above ships in both `en.json` and `ar.json` in the same commit; Arabic keeps Latin digits.
- The map box stays `dir="ltr"` (house rule 4); everything around it — legend, "Search this area" button and hint, chips, notes — sits outside it and is written with logical properties, so it mirrors in Arabic. Popup HTML inside the map gets its own `dir`.
- Map place-name labels follow the page language when Protomaps is in use (Arabic names on `/ar`, English on `/en`, A8).
- Alert emails use the recipient's saved `locale`; Arabic emails are RTL by attribute; plain text is always included in the same language.
- Data names use `localName` (Arabic optional, falls back to English).

## Done when (checklist the owner can verify)

- [ ] `/ar/market` shows the coloured price map, legend on the correct (right) side, and a "Sample data / بيانات تجريبية" note while only sample data exists.
- [ ] Areas without figures are grey "No data"; clicking a circle offers a link to that area's page.
- [ ] Opening `/market` does not download the map code until the page has drawn.
- [ ] On `/properties`, dragging the map changes nothing until "Search this area / ابحث في هذه المنطقة" is pressed; pressing it changes the results and the web address.
- [ ] Saving that search keeps the map area; reopening it from the account page shows the same area.
- [ ] Running the job with the secret (curl) writes one email file to the outbox, in the right language; a second run writes nothing new; a wrong secret gets 401.
- [ ] Without email keys the job says "not configured" and loses nothing.
- [ ] The account page tells the truth about whether alerts are being sent.
- [ ] Privacy page (both languages) describes alert emails, the alert log and the map tile server.
- [ ] Everything works at 390px (phone) and 1280px (laptop), English and Arabic, light and dark, with no sideways scrolling.
- [ ] With the Protomaps address not set, the map looks exactly as it does today; with a test map file set, Arabic place names show on `/ar`.
- [ ] `npm run verify` is green, including the new tests (map weakest-source, bounds validation, email template, idempotent job).
- [ ] GO-LIVE.md, CONVENTIONS.md and `.env.example` match the code (including the Cloudflare R2 map-file steps).

## Recommend `ui-designer` runs before building

Yes — screens are new: the price-map card with its legend (mirrored), the "Search this area" button and area chip on phone and laptop, the map-moved hint, and the alert email in English and Arabic (RTL). Suggest the designer pulls the Mobbin flows listed above first. Builders A and B should not start layout until the legend/button positions are fixed; Build C's job, migration and template logic can start immediately.

## Open questions (with my suggested defaults)

**Decisions recorded**
- Tile provider: Protomaps (owner, 30 Sep 2026) — see A8.

1. **Click on a circle: popup first, or straight to the area page?** The plan says "click → neighbourhood page". Default: popup with a "View area" link (safer on phones where a fingertip lands on the wrong circle).
2. **How to rank "weakest source" on the map legend.** Default order, weakest first: Sample data, AI estimated, User submitted, From live listings, Official statistic, Verified — ties broken by lowest confidence.
3. **Alert behaviour on a failed or interrupted send.** Default: at most once — a reported failure is retried next hour; a crash mid-run may lose one email but never sends a duplicate. Same run gives a person no more than 10 alert emails in 24 hours and each email shows up to 5 listings. Say if you would rather risk an occasional duplicate than a lost email.
