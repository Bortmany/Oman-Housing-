# Align 7 — Getting found: search-engine setup, share previews and visitor stats

App: Oman Property Intelligence. Round: alignment, Oct 2026, Step 7 of `docs/visions/build/oman-property.md` (Agents repo).
Written: 2026-09-30. Two independent builds, meant to run side by side by two builders:

- **Build A — SEO and share previews** (sitemap, robots, language links, share tags, default image)
- **Build B — Visitor stats** (a privacy-friendly counter, switched on by settings, off by default)

They share one file (`messages/en.json` + `ar.json`) and one config file (`next.config.ts`, Build B only). Build A does not touch `next.config.ts`; Build B does not touch any `generateMetadata`. Merge conflicts should be limited to the message files (each build adds its own new keys, no edits to existing ones).

## Backlog rows matched

No row in `Agents/docs/backlog.md` was opened for this (I do not edit it). It is Step 7 of the build plan. Depends on Step 1 (`align-1-honest-data.md`) for the `isSample` flag. That spec was not in this worktree when I wrote this, so where it says "the sample flag" below, the builder must use the exact field names Step 1 actually shipped (the build plan says `isSample Boolean @default(false)` on `MarketStat`, `Property`, `Listing`, `ValuationEstimate`). If Step 1 is not merged when Build A starts, build the filter against the planned names and stop and report if they differ.

## What I could and could not check

- Checked in the repo: every `generateMetadata`, `src/app/[locale]/layout.tsx`, `next.config.ts` (CSP), `src/app/api/health/route.ts`, `src/proxy.ts`, `src/i18n/routing.ts`, the privacy page, `messages/en.json` privacy block, `prisma/schema.prisma`, `src/lib/db/listings.ts`, `public/`, `.env.example`, `GO-LIVE.md`, and the bundled Next 16 docs for `sitemap`, `robots` and `metadataBase`/`alternates` (all three still work as in earlier versions).
- Could NOT check: `docs/decisions/ads-stats-and-services.md` (does not exist in this worktree yet — the stats tool is undecided, so Build B is tool-neutral by design), `align-1-honest-data.md` (not present), and Mobbin (no Mobbin tool in this session). Prior art below is from general knowledge of Google's and Next's documented patterns, not cited Mobbin flows. This feature has no new screens, so nothing depends on it.

## 1. The problem, in the owner's words (from the build plan)

"Google can index both languages properly, links look right when shared, and the owner can see visitor numbers without tracking anyone."

What exists today (verified):
- No `sitemap`, no `robots`, no share image (`public/` holds only five stock icons: file, globe, next, vercel, window).
- Only page titles (and the site-wide description in the locale layout). No `metadataBase`, no language alternates, no `openGraph`/`twitter` tags anywhere.
- The home page, the neighbourhood page (`/market/[neighborhood]`) and the property page (`/properties/[id]`) have NO `generateMetadata` at all — so a shared property link currently shows only the site name and tagline.
- Every page lives under a language prefix (`/en/...`, `/ar/...`; `localePrefix: "always"`), so there are always two versions of each page and search engines need to be told they are the same page.
- No visitor counting at all. The privacy page says "We do not use advertising or tracking cookies" (Build C of Step 3 rewrites that sentence; see section on the privacy line).

## 2. Screens and behaviour

There are no new screens. Everything below is behind-the-scenes output, except the one privacy-page line.

### Build A — SEO and share previews

**A1. Web address base.** One small helper (suggested `src/lib/siteUrl.ts`) reads `AUTH_URL` (already an env var, documented in CONVENTIONS and `.env.example`; set to `http://localhost:3000` locally) and returns the site's base address with no trailing slash. It is the ONLY place the base is read. Used for `metadataBase`, sitemap, robots, canonical and language links, and share-image addresses. In production with `AUTH_URL` unset: do not crash the build; fall back to `http://localhost:3000` only outside production, and in production log one warning and skip the sitemap entries rather than publish localhost addresses (the sitemap is then empty and robots omits the `Sitemap:` line). Add a line to `GO-LIVE.md` "set `AUTH_URL` … also drives the sitemap and share links".

**A2. `src/app/sitemap.ts`** — one file, both languages. Every entry is the full address with the language prefix.
Included (each in `/en/...` and `/ar/...`):
- Home `/`, `/market`, `/calculators`, the four calculator pages (`/calculators/mortgage`, `/rental-yield`, `/roi`, `/affordability`), `/properties`, `/list-with-us`, `/privacy`, `/terms`.
- Every neighbourhood page `/market/<slug>` — one per `Neighborhood` row (slug is unique in the schema). Skip a neighbourhood that has no real (non-sample) market figures at all, because the page would show only sample data.
- Every property page `/properties/<id>` for a property that has at least one listing with status `ACTIVE` AND is not a sample record AND whose listing is not sample.
Excluded on purpose: `PENDING_REVIEW`, `DRAFT`, `REJECTED`, `SOLD`, `RENTED`, `ARCHIVED` listings; properties with no active listing; sample records (Step 1 flag); `/login`, `/register`, `/favorites`, `/account`, everything under `/admin` and `/agency`, the two compare pages (`/market/compare`, `/properties/compare` — they need query parameters and are near-duplicates), `/api/*`.
Each entry carries the language alternates (`alternates.languages` with `en`, `ar`, and `x-default` all present so search engines pair the two versions). `x-default` points to the English page of that same path. `lastModified`: property = the newest of property/listing `updatedAt`; others omit it (do not invent dates).
Safety valve: a sitemap file is limited to 50,000 addresses; the property list must be capped (suggest 20,000 properties) and newest first, with a note in the code comment for when to switch to multiple sitemaps.
Split for testing: a pure function `buildSitemapEntries(input, baseUrl)` in `src/lib/sitemap.ts` that takes plain lists (neighbourhood slugs, property ids with listing status/sample flags/dates) and returns entries. `sitemap.ts` only loads data and calls it. The filter for "skip pending and sample" lives inside the pure function, not the query, so it is testable.

**A3. `src/app/robots.ts`.**
- Allow everything public; block crawlers from `/admin`, `/agency`, `/account`, `/api` — **but paths are language-prefixed, so block both forms**: `/en/admin`, `/ar/admin`, `/en/agency`, `/ar/agency`, `/en/account`, `/ar/account`, `/api/`. Also block `/en/login`, `/ar/login`, `/en/register`, `/ar/register`, `/en/favorites`, `/ar/favorites`. (A plain `/admin` line alone would block nothing — every real admin address starts with `/en` or `/ar`.)
- **Trap to avoid:** photos are served from `/api/images/...`. Blocking `/api` would also block share-preview scrapers and Google Images from fetching listing photos. Add `Allow: /api/images/` (more specific rule wins) so photos stay fetchable while the rest of `/api` is blocked. Verify with a listing photo URL.
- `sitemap:` line = base + `/sitemap.xml`.
- Note for the owner in `GO-LIVE.md`: robots.txt is a request, not security; the real protection of admin/agency pages is the login gate in `src/proxy.ts` (already exists). Add `noindex` too: `generateMetadata` (or a `robots: { index: false }` field) on the admin, agency, account, favourites, login, register pages and both compare pages. Where a page already has `generateMetadata`, add the field; do not restructure the pages.

**A4. Head tags on every public page.** Set once in the locale layout, then override per page:
- `metadataBase` = A1 base.
- Layout default: `openGraph` (`siteName` = existing `common.appName`, `type: "website"`, `locale` `en_US`/`ar_OM`, default image) and `twitter` (`card: "summary_large_image"`, same image). Title template already exists (`%s · <appName>`).
- Every public page with a `generateMetadata` (`market`, `market/compare`, `calculators` + 4, `properties`, `properties/compare`, `list-with-us`, `privacy`, `terms`) gains `alternates: { canonical: <this page in this language>, languages: { en, ar, "x-default": <English page> } }` and a description. Suggested: a small helper `pageAlternates(pathWithoutLocale, locale)` in `src/lib/siteUrl.ts` so 15 pages do not each hand-roll it. Pages with no description of their own inherit the site tagline (already done by the layout) — do not add new copy for the calculators unless a `description` key already exists in their namespace; the calculators index already has `rentalYield.description` etc. that can be reused.
- Home page, neighbourhood page and property page get NEW `generateMetadata` (they have none today):
  - Home: title = default (site name), description = existing `home` tagline (`messages` line 42), alternates as above.
  - Neighbourhood: title = neighbourhood name (localised via `localName`), description from `descriptionEn/Ar` when present (first ~160 chars), else a generated line (string below). 404 case: return `{}` (the page itself calls `notFound()`).
  - Property page: see A5.
- Canonical always points to the same language the visitor is reading (each language is its own canonical, and the pair is linked through `languages`). Query strings (`?type=...`, filters) are NOT in the canonical, so filtered search pages fold into `/properties`.

**A5. Listing share tags (photo + price).** The property page (`/properties/[id]`) is keyed by property id and shows every property whether or not it has an active listing. In its `generateMetadata`:
- Title = the property title in the reader's language (`localName`, already used on the page), falling back to English exactly like the page does.
- Description = short line: type, neighbourhood, city, and the ASKING price of the newest ACTIVE listing formatted with `formatOMRWhole` (house rule 2 — never hand-format money; Latin digits in Arabic), plus "/month" style wording for rentals. If there is no active listing, leave the price off (do not show a price from anywhere else).
- Image = the primary photo (`isPrimary`, else first by sort order) as an absolute address: base + `/api/images/<storagePath>`; `openGraph.images` and `twitter.images`. If the property has no photo, use the default share image (A6). Alt text = existing photo alt (localised).
- `openGraph.type: "website"` is fine; do not add structured-data/price schema in this round (out of scope).
- `robots: { index: false, follow: true }` when the property has NO active listing OR is a sample record — the page stays reachable by link but is kept out of search results. Sample-data honesty: the same reason they are kept out of the sitemap.
- Data honesty note: the price in a share preview is text without a provenance badge nearby. It is the agency's asking price and the wording says "Asking" so it is not presented as a valuation. It is the ONLY figure allowed in the tags — no estimated yield, no "fair value" etc. (house rule 1).

**A6. Default share image.** One image in `public/` (suggested `public/og-default.png`, 1200×630, under ~300 KB), showing the site name (both languages side by side is best, because a shared link may be seen in either) and the tagline. Referenced from the layout `openGraph`/`twitter` tags. The CSP already allows images from `'self'`. Note `src/proxy.ts` matcher skips any path with a dot, so `/og-default.png`, `/sitemap.xml` and `/robots.txt` are served directly and are NOT redirected to `/en/...` — the builder must confirm with a real request. `ui-designer` (or the owner) supplies the image artwork; the builder must not ship a stock icon. If no artwork is ready, the builder ships a plain solid-colour placeholder with the site name and flags it in the report so it is replaced before launch.

**A7. Tests (Build A).** `src/lib/sitemap.test.ts`, run in `npm test`:
1. Both languages appear for every static path; every entry has `en`, `ar` and `x-default` alternates that point at the same page.
2. A property with only `PENDING_REVIEW` (or `DRAFT`, `REJECTED`, `ARCHIVED`, `SOLD`, `RENTED`) listings is NOT in the output; one with an `ACTIVE` listing IS.
3. A sample property, and a property whose only active listing is sample, are NOT in the output.
4. `/admin`, `/agency`, `/account`, `/login`, `/register`, `/favorites`, compare pages, `/api` never appear.
5. All addresses start with the base (no trailing-slash doubling; base with trailing slash handled).
6. Cap: more than the limit in gives exactly the limit out.
Plus a small test for the base-address helper (unset in production, trailing slash, invalid value) and for the robots rules (both `/en/...` and `/ar/...` blocked; `/api/images/` allowed).

### Build B — Visitor stats (tool-neutral, off by default)

Purpose: the owner sees visits/pages/countries in the chosen tool's own dashboard. Nothing is stored in this app's database. The tool itself is decided elsewhere (Plausible, Umami or GoatCounter); this build must work for all three by settings only.

**B1. Settings (environment variables).** All three are public-safe values (the script address and a site label are visible in any page's source anyway):
- `NEXT_PUBLIC_STATS_SCRIPT_URL` — full address of the tool's script, must start with `https://`.
- `NEXT_PUBLIC_STATS_SITE_ID` — the site identifier the tool needs (Plausible: the domain; Umami: the website id; GoatCounter: the full counting address such as `https://name.goatcounter.com/count`).
- `NEXT_PUBLIC_STATS_ATTR` — optional; the name of the attribute the script reads its site id from. Default `data-website-id` (Umami). Plausible: `data-domain`. GoatCounter: `data-goatcounter`.
"Configured" = script URL is a valid `https://` address AND site id is non-empty. Anything else counts as not configured (a bad value is ignored with one server-side log warning, never a crash).

**B2. When not configured (the default):** no script tag is added, the CSP is byte-for-byte what it is today, `/api/health` shows `stats: "dormant"` to admins, and the privacy page has no stats line. This must be proven by test/check, because it is the state at launch.

**B3. When configured:**
- The locale layout adds one `<Script strategy="afterInteractive" defer>` with the script URL and the site-id attribute. Suggested small component `src/components/analytics/StatsScript.tsx` (server component; renders nothing when unconfigured), placed next to the theme script in `src/app/[locale]/layout.tsx`. It must NOT add a cookie, NOT write to local storage, NOT add any "consent banner" — the tools listed are cookieless and this build must not add any that are not. The builder verifies in a browser that the site's cookie list is exactly what it was before (login cookie only, when signed in).
- `next.config.ts` adds the script's origin to `script-src` and `connect-src` (the counting call goes to the tool's own host), the same way the Turnstile origin is added today (`turnstileOrigin`: computed from env, empty string when unset, appended to the existing directives). If the site-id is itself an `https://` address on a different host (GoatCounter), that origin is also added to `connect-src`. Nothing else in the CSP changes; no `unsafe-eval`; no wildcard hosts. Also add an `img-src` allowance only if the chosen tool needs a tracking pixel (check the tool's docs at build time; default: not needed).
- Since `next.config.ts` runs before the app, keep the parsing in a tiny pure function `src/lib/stats.ts` (`parseStatsConfig(env) → { configured, scriptUrl, siteId, attr, origins[] }`) with tests, and check whether `next.config.ts` can import it in this Next 16 setup; if not, repeat the few lines inline (like the tile/Turnstile helpers) and have the test cover the shared logic so drift is visible. Verify the CSP against a RUNNING server (standards §6), including `curl -I` of a page with the settings on and off.
- Admin and agency pages: default is that the script loads everywhere the layout renders, including `/admin` and `/agency` (see open question 2).
- `/api/health`: add `stats: "configured" | "dormant"` inside the existing admin-only `integrations` object, next to `captcha` and `signups`. Anonymous callers still get only `ok`/`db`. Show only that it is on, never the script address or site id.
- Docs: `.env.example` (three commented lines), `GO-LIVE.md` (one "Visitor stats" item in the optional list, same style as Turnstile: what to set, "dormant until both are set", check at `/api/health`), and `docs/CONVENTIONS.md` env var list.

**B4. Privacy page line (same build, both languages).** In `src/app/[locale]/(public)/privacy/page.tsx` the "What we collect" list gains ONE line, shown ONLY when stats are configured (so the page is never claiming something that is off). New key `legal.privacy.collectStats` (Step 3 Build C reserved a place for this line; if Build C's rewrite is already merged, add this key after theirs and do not edit their wording; do not touch `collectTechnical`).

Exact strings:
- EN: `Visitor statistics — if switched on, we count visits with a privacy-friendly tool: which pages are viewed and, roughly, which country and type of device visitors use. It sets no cookies, does not follow you between websites, and does not identify you personally.`
- AR: `إحصاءات الزوار — عند تفعيلها، نعدّ الزيارات بأداة تحترم الخصوصية: أي الصفحات تُعرض، وبشكل تقريبي بلد الزائر ونوع جهازه. لا تضع أي ملفات تعريف ارتباط (كوكي)، ولا تتبّعك بين المواقع، ولا تحدد هويتك الشخصية.`
The builder checks the final wording against the chosen tool's own data-handling page once the tool is picked (for example, whether the tool keeps any IP address at all) and, if any claim is not true for that tool, softens the line rather than shipping it. Bump `legal.privacy.updated` date in both languages in the same change (the page says "Last updated"). Note that the existing "we do not use advertising or tracking cookies" sentence stays true: visitor stats add no cookies.

**B5. Tests (Build B).** `src/lib/stats.test.ts` in `npm test`: unset → not configured and no origins; `http://` script rejected; missing site id rejected; valid Umami-style values → configured with the script's origin; GoatCounter-style site id adds its own origin; attribute defaults to `data-website-id`; junk strings do not throw.

## 3. Bilingual notes

- Both languages are first-class here: the sitemap lists both; `alternates.languages` links them; `openGraph.locale` is `en_US` on `/en`, `ar_OM` on `/ar` (with the other as `alternateLocale`); `<html lang/dir>` already switches in the layout.
- All new visible or shared text goes in `messages/en.json` AND `ar.json` in the same commit (house rule 3). New keys (suggested namespace `seo`):
  - `seo.neighborhoodDescription` — EN: `Property market trends, average prices and rents in {area}, {city} — every figure labelled by its source.` AR: `اتجاهات سوق العقارات ومتوسط الأسعار والإيجارات في {area}، {city} — كل رقم مصنّف بمصدره.`
  - `seo.propertyDescriptionSale` — EN: `{type} in {area}, {city}. Asking price {price}.` AR: `{type} في {area}، {city}. السعر المطلوب {price}.`
  - `seo.propertyDescriptionRent` — EN: `{type} in {area}, {city}. Asking rent {price} per month.` AR: `{type} في {area}، {city}. الإيجار المطلوب {price} شهرياً.` (for `ANNUAL` rent periods use the existing `enums.rentPeriod.ANNUAL` wording in place of "per month"; the builder reads `rentPeriod` from the listing)
  - `seo.propertyDescriptionNoPrice` — EN: `{type} in {area}, {city}.` AR: `{type} في {area}، {city}.`
  - `seo.defaultShareAlt` — EN: `Oman Property Intelligence — real estate data for Oman` AR: `ذكاء العقارات عُمان — بيانات عقارية لسلطنة عُمان`
- `{type}` uses the existing `enums.propertyType.*` names; `{area}`/`{city}` use `localName` (Arabic falls back to English when the Arabic name is missing, as everywhere else). `{price}` comes from `formatOMRWhole(value, locale)` — never typed by hand.
- The privacy line strings are in B4.
- The default share image shows both the English and Arabic site names.

## 4. Data touched

- Build A: reads only. Neighbourhoods (slug), properties, their listing status and dates, primary photo, and the Step 1 sample flag. No new tables, no new columns, no migration.
- Build B: no database change at all. No visitor data is stored in this app. New personal data collected by the SITE: none stored by us; the third-party tool counts page views without cookies (see standards flags).

## 5. Standards flags (`Agents/docs/engineering-standards.md` §6–8)

- **New personal data / privacy page (§6):** YES for Build B (a third-party counter sees visits) — the privacy page must change in the same build; that is B4. Build A collects nothing. Also: the CSP is only changed when stats are configured and must be verified against a running server.
- **Core guarantee (§7):** Build A touches the app's guarantee at one edge — "data honesty / never show a made-up number". Sample records must never be advertised to search engines or share previews, and share tags may carry only the listing's asking price. The spec REQUIRES tests for this: A7 items 2 and 3 plus a test that the share-description builder (put the text assembly in a pure function, e.g. `buildPropertyShareText` in `src/lib/sitemap.ts` or a sibling file) never includes a price when there is no ACTIVE listing and never includes any figure except the asking price. Build B does not touch the guarantee.
- **Mutations / external calls / rate limiting:** none of the new endpoints mutate anything. `sitemap.xml` and `robots.txt` are cached GET routes (Next caches these by default; the sitemap reads the database, so the builder sets a sensible refresh, suggested every hour, and does not make it request-time so a crawler cannot hammer the database). Build B adds a browser-side call from visitors to the stats tool's host, not from our server. Rate limiting: none needed, because crawlers only read cached output; the property share tags run inside the existing page request (already public and unlimited like the page itself).
- **Backups (§8):** nothing new to back up (no new stored data).

## 6. Explicitly out of scope

- Choosing the stats tool, creating an account with it, or hosting it (owner decision in `docs/decisions/ads-stats-and-services.md`).
- Any change to which pages exist, page copy beyond the strings listed, or the visual look of any page.
- Structured data (JSON-LD, price/"RealEstateListing" markup), image sitemaps, video sitemaps, hreflang for regions other than en/ar.
- A dynamic per-listing generated share image (the photo is used as-is; the default image is one static file).
- Consent banners, cookie pop-ups (the design avoids needing one), ad tracking, heat maps, session recording, or per-user analytics inside the app, or showing stats inside the admin area.
- Google Search Console / Bing Webmaster verification (owner registers the site and submits the sitemap after launch — add one line to `GO-LIVE.md`).
- Changing the login gate or admin security.
- Fixing the ~15 other pages' copy or adding descriptions to pages that have none of their own (they inherit the site tagline).

## 7. Done when (the owner or a tester can check each)

Build A
- [ ] Opening `/sitemap.xml` on the running site lists the home page, market, calculators (all four), properties, list-with-us, privacy and terms in BOTH `/en` and `/ar`, plus every neighbourhood, plus properties that have a live listing.
- [ ] A property whose only listing is waiting for review (pending), a draft, rejected, sold/rented/archived, or that is marked sample, is absent from `/sitemap.xml`.
- [ ] No address in the sitemap contains `admin`, `agency`, `account`, `login`, `register`, `favorites`, `compare` or `/api`.
- [ ] `/robots.txt` blocks `/en/admin`, `/ar/admin`, `/en/agency`, `/ar/agency`, `/en/account`, `/ar/account`, `/api/` and points to the sitemap; but a listing photo address (`/api/images/...`) is still allowed.
- [ ] View-source of `/en/market` shows a canonical link and three language links (`en`, `ar`, `x-default`); `/ar/market` shows the same three pointing at the same pair.
- [ ] View-source of a property page shows share tags with the property title, its main photo as a full web address, and (when it has a live listing) "Asking price OMR …" with Latin digits in the Arabic page too; a property with no live listing or that is sample has `noindex` and no price.
- [ ] Pasting a property link into WhatsApp (or a share-preview checker) on the phone preview shows photo + title + price; pasting the home link shows the default share image.
- [ ] Every address in these tags starts with the site address from `AUTH_URL`, not `localhost`, when `AUTH_URL` is set to the live address.
- [ ] `npm run verify` passes including the new sitemap/robots/base-address tests.

Build B
- [ ] With the three `NEXT_PUBLIC_STATS_*` settings absent: page source has no stats script, response headers are identical to before, `/api/health` (signed in as admin) says `stats: dormant`, the privacy page has no visitor-statistics line.
- [ ] With them set to a real tool: page source has exactly one stats script; the browser console shows no CSP violation; the tool's dashboard shows the visit; `/api/health` as admin says `stats: configured`; a signed-out request to `/api/health` shows neither.
- [ ] The browser's cookie list gains nothing (still only the login cookie when signed in).
- [ ] Privacy page shows the new line in English at `/en/privacy` and Arabic at `/ar/privacy` (right-to-left) only when configured, and the "Last updated" date changed in both.
- [ ] `.env.example`, `GO-LIVE.md` and `docs/CONVENTIONS.md` mention the new settings and `AUTH_URL`'s new job.
- [ ] `npm run verify` passes including the new stats-setting tests.

## 8. Recommend `ui-designer`?

No new screens, so `ui-designer` is not required before building. Optional: one short `ui-designer` pass for the default share image artwork (1200×630, bilingual name + tagline) so the builder is not left with a placeholder.

## 9. Open questions (with my suggested default)

1. **Which stats tool?** Not mine to pick — the owner's decision doc covers it. Default: build tool-neutral as specced; the owner sets the three settings when the tool is chosen. Only the privacy line's wording may need a tweak after that.
2. **Count visits to admin, agency and account pages?** Default: yes for simplicity (one script in the layout), and the owner filters those paths in the tool's dashboard; if the owner would rather they not be counted at all, the builder can skip the script on paths starting `/en/admin`, `/ar/admin`, `/en/agency`, `/ar/agency`, `/en/account`, `/ar/account`.
3. **Should sample-data properties be reachable by search at all?** Default: they stay out of the sitemap and get `noindex` (so a demo listing cannot show up as a real one on Google), but the pages themselves still work for anyone with the link. The alternative (index them) contradicts house rule 1.
