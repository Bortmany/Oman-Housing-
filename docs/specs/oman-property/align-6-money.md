# Oman Property Intelligence — Money: ads, featured listings, Thawani checkout, honest legal pages (alignment round, Step 6)

Status: NOT BUILT. Written 30 Sep 2026 against the `align-2026-10` worktree (read-only; I could not run the app, git or the tests in this session, so builders must confirm each "already exists" claim before relying on it).
Spec for three parallel builders (A ads, B featured + checkout, C privacy/terms/docs). Depends on the owner's answers in `docs/decisions/ads-stats-and-services.md` (all accepted 30 Sep 2026: Thawani Pay, bank transfer + hand-featuring until keys exist, launch prices, max 3 featured per results page, "Featured / مميز" and "Ad / إعلان" labels, no third-party ad scripts).

Reads first (every builder): `AGENTS.md` (Next 16 has breaking changes; docs are in `node_modules/next/dist/docs/`), `docs/CONVENTIONS.md` (rule 1 honest data, 2 OMR 3 decimals, 3 bilingual, 4 logical properties, 5 navigation helpers, 7 role checks in every admin action, 8 uploads under `DATA_DIR`, 11 real migrations), `Agents/docs/engineering-standards.md` §6-8, and the earlier specs in this folder (align-1, 4, 5, 7).

Backlog match: `Agents/docs/backlog.md` row "Payment provider decision — agency tiers (FREE/PREMIUM/BUSINESS) gate listings but nothing is chargeable". This build answers the provider question (Thawani) and makes **featured listings** chargeable; it does **not** make agency plan tiers chargeable (see Out of scope), so that row stays open in part. Backlog not edited (owner's file).

Prior art (Mobbin): **I had no Mobbin access in this session, so no `mobbin_url` is cited and nothing below claims what another app does.** `ui-designer` should pull, before building: Bayut and dubizzle "feature / promote your ad" checkout flows and OpenSooq "promote" flow (the apps Omani sellers already use, named in `docs/user-testing/research.md`), and one marketplace that labels sponsored results clearly (Etsy "Ad by", Airbnb-style promoted cards) for the label and card treatment.

---

## 1. The problem, in the owner's words

> "The site can earn: ads sold directly, featured listings paid online; the privacy page tells the truth about both." (build plan, Step 6)

> "Thawani Pay (bank transfer + admin hand-featuring until keys exist). Featured 3.000 OMR owners / 6.000 OMR agencies per 30 days at launch (later 6/12) — prices are settings, not hard-coded. Max 3 featured per results page. Always labelled 'Featured / مميز' and 'Ad / إعلان'. No third-party ad scripts." (owner's answers, 30 Sep 2026)

Today nothing on the site can be paid for. `searchListings` orders every result by newest published; there is no ad slot anywhere; the checkout the deferred note in `GO-LIVE.md` line 34 describes does not exist; and the privacy page says "We do not use advertising or tracking cookies" with no mention of ads or payments.

Three things ship together, in three builds that do not share files:
1. **A — Ads.** Direct-sold banners in three fixed places (plus an optional neighbourhood sponsor strip), managed in `/admin/ads`. Always labelled. An empty slot shows nothing.
2. **B — Featured listings and checkout.** A listing owner or agency pays to appear first (max 3 per results page) for 30 days, through Thawani Pay once keys exist; until then the admin features a listing by hand after a bank transfer. Prices are editable settings.
3. **C — Privacy, terms and go-live notes.** Both legal pages rewritten truthfully in English and Arabic, and the owner's setup steps written into `GO-LIVE.md`.

## 2. What I checked in the code (facts)

- **Search ordering:** `searchListings` in `src/lib/db/listings.ts` returns ACTIVE listings only, `orderBy publishedAt desc`, `take: 60`. There is **no pagination**: "a results page" today is the whole list of up to 60. The 3-featured cap is written per page so it still holds if pagination is added.
- **Cards:** `src/components/marketplace/ListingCard.tsx` shows photo, price (`formatOMRWhole`), title, area, and a `ProvenanceBadge` at the bottom. No ribbon or label of any kind.
- **`formatOMRWhole` rounds to whole rials** ("OMR 3"). Every price in this build (3.000, 6.000, 35.000...) must therefore use **`formatOMR`** (3 decimals, Latin digits in Arabic via `ar-OM-u-nu-latn`), never `formatOMRWhole`.
- **Home page** (`(public)/page.tsx`) is a plain static component. Putting a database-backed ad on it makes it render per request (accepted; see Build A).
- **Market page** (`(public)/market/page.tsx`) is single-column (`max-w-6xl`), no sidebar today. Align-5 Build A also edits this file (price map).
- **Property page** (`properties/[id]/page.tsx`): right-hand column starts with `FinancialAnalysisCard`, then the AI analyst, contact, enquiry, map. Align-4 Build A also edits this file (gallery, owner contact).
- **Neighbourhood page** (`market/[neighborhood]/page.tsx`) exists and loads by slug.
- **Uploads:** `src/lib/storage.ts` has `savePropertyImage` (file type read from the file's own first bytes, 5 MB cap, random name under `DATA_DIR`), a private `sniffImageExt`, `deleteStoredFile`, `resolveStoredPath`. `/api/images/[...path]` serves any JPEG/PNG/WebP under `DATA_DIR` (path-traversal guarded, `Cache-Control: immutable`), so `ads/...` paths need no new serving route.
- **Content-Security-Policy** (`next.config.ts`): `img-src 'self' data: blob:` + tile origin, `connect-src 'self'` + tile origin, **`form-action 'self'`**, no third-party script origins except Turnstile when keyed. Consequences: ad images from `/api/images` already pass; **a normal HTML form whose response redirects to Thawani would be blocked by `form-action 'self'`** in browsers that check redirects, so checkout must hand the browser a URL and navigate with script, and the CSP must **not** be loosened (verify against a running server, standards §6).
- **Proxy** (`src/proxy.ts`): `/api/*` is passed through without a language prefix and gated only for `/admin` and `/agency`. The click route lives under `/api/ads/...`.
- **Rate limiting:** `checkRateLimit(key, {limit, windowMs})` in `src/lib/rate-limit.ts`, in-memory per process (the `REDIS_URL` seam is still not wired; accepted). Admin actions use the local `adminAllowed()` pattern (`admin:user:<id>` 120/min, see `admin/agencies/actions.ts`). `getClientIp(headers)` exists in `src/lib/clientIp.ts`.
- **Admin guards:** `requireAdmin()` (actions) and `enforceAdminPage()` (page, first line, before any query) in `src/lib/require-admin.ts`.
- **Admin home** (`(admin)/admin/page.tsx`) is a card grid with counts; align-4 Build C adds a "Site settings" card.
- **`SiteSetting` table and `src/lib/siteSettings.ts` do not exist yet** in this worktree; align-4 Build C creates them (`key` text primary key, `value` text, `updatedAt`; exports `getFreeLaunch()`). Money **reuses** that table. Money merges after align-4.
- **`isSample` does not exist yet**; align-1 adds it to `Listing`. Featured code must refuse sample listings when that column is present.
- **No Thawani code exists in this repo.** Only the deferred note (`GO-LIVE.md` line 34, `README.md` line 58).
- **Privacy/terms pages:** `privacy/page.tsx` renders a fixed `collectKeys` list then use/share/retention/PDPL sections; `terms/page.tsx` renders a fixed `sections` pair list. Both read `legal.*` messages and carry the "template pending professional review" notice. `legal.privacy.collectTechnical` (en.json line ~740) contains the sentence "We do not use advertising or tracking cookies." Other specs already edit these pages (see 3.4).

### How Dukkani's Thawani code works (the pattern mirrored), and what it does NOT do
File: `Dukkani/src/lib/integrations/thawani.ts` plus the routes `.../orders/[orderNumber]/thawani-session` and `.../thawani-return`.
- **Dormant until keys:** `isThawaniEnabled()` = both `THAWANI_API_KEY` and `THAWANI_PUBLISHABLE_KEY` set. `THAWANI_ENV` = `sandbox` (default, `uatcheckout.thawani.om`) or `production` (`checkout.thawani.om`).
- **Create session:** `POST {base}/checkout/session` with header `thawani-api-key`, body `client_reference_id`, `mode: "payment"`, one product with `unit_amount` in **baisa** (whole numbers, 1 OMR = 1000), `success_url`, `cancel_url`, `metadata`. The response gives `data.session_id`. The customer is sent to `{host}/pay/<session_id>?key=<publishable key>`.
- **Confirmation is a lookup, not a signed webhook.** Thawani sends the customer's **browser** to our `success_url`; our route then calls `GET {base}/checkout/session/<session_id>` with the secret key and only marks the order paid if `data.payment_status === "paid"`. **Dukkani has no webhook receiver and no signature check.** The decision file says Thawani documents webhooks, but I could not verify a signing scheme here, and the proven, shipped pattern is the server-side lookup. **This spec therefore builds the security rule on the lookup**: the browser is never believed; only Thawani's own answer, fetched by our server with our secret key, counts. If a webhook receiver is added later, it may only be a "wake-up" that triggers the same lookup; it is never trusted on its own.
- **What Dukkani lacks and this build adds:** `thawaniSessionId` there is a plain nullable text column (not unique, so one gateway session could in principle be attached to two records); the order flip is "if already paid, skip" with no atomic compare-and-set; nothing is logged when a confirmation is refused; the amount Thawani reports is never compared with the amount we asked for; the raw gateway answer is not kept; amounts go through floating-point (`Math.round(roundOMR(x) * 1000)`). Oman Property fixes all five (section 7).
- Dukkani's own `GO-LIVE.md` rule to copy: test with sandbox keys, then live keys with `THAWANI_ENV=production` and **one real payment made by the owner** before telling anyone cards are on.

## 3. Who builds what — three briefs, explicit file ownership

Merge order for dev-lead: **align-4 (C → A → B), align-1 and align-5 first, then Money B → A → C.** Money B first because it changes the search query and adds a settings helper; A next; C last so it can read the final state of both legal pages and write the go-live steps from what actually shipped. Each builder works in its own worktree and test database. If a builder needs a file it does not own, it **stops and asks dev-lead**; it does not edit it.

### 3.1 File ownership

| Builder | Owns (may create or edit) |
|---|---|
| **A — Ads** | `prisma/schema.prisma` (`AdCampaign`, `AdDailyStat`, enum `AdSlotKey` **only**) + migration e.g. `add_ad_campaigns`; `src/lib/ads/**` (+ tests); `src/lib/db/ads.ts`; `src/components/ads/**` (`AdSlot`); `src/app/api/ads/[id]/click/route.ts`; `src/app/[locale]/(admin)/admin/ads/**`; `src/lib/storage.ts` (add `saveAdImage`, additive only); `src/app/[locale]/(admin)/admin/page.tsx` (adds **both** new cards: "Ads" and "Payments", so only one builder edits this file); the one-line slot insertions in `(public)/page.tsx`, `(public)/market/page.tsx`, `properties/[id]/page.tsx`, `market/[neighborhood]/page.tsx` (each insertion is an `AdSlot` and, for market, the two-column wrapper; nothing else in those files) |
| **B — Featured + Thawani checkout** | `prisma/schema.prisma` (`Listing.featuredUntil`, `Payment`, `PaymentEvent`, their enums **only**) + migration e.g. `add_featured_listings_and_payments`; `src/lib/integrations/thawani.ts`; `src/lib/payments/**` (+ tests: price reader, decision/confirm logic, baisa maths); `src/lib/featured.ts` (+ tests); `src/lib/siteSettings.ts` (additive: a generic `getSetting`/`setSetting` pair **only if** align-4 C shipped only `getFreeLaunch()`); `src/lib/db/listings.ts` (search ordering + `featuredUntil` on the returned rows); `src/components/marketplace/ListingCard.tsx` and a new `FeaturedLabel`; `src/app/[locale]/(app)/feature/**` (checkout page, result page, actions); `src/app/api/payments/thawani/return/route.ts`; `src/app/[locale]/(admin)/admin/payments/**`; `src/app/[locale]/(admin)/admin/settings/prices/**`; a link on `(admin)/admin/listings/[id]/page.tsx`; `src/app/api/health/route.ts` (adds `payments`); `src/components/listing-form/ListingActionsPanel.tsx` **only to add one "Feature this listing" button, and only if align-4 is merged** (otherwise B ships the page and dev-lead wires the button). |
| **C — Legal + docs** | `src/app/[locale]/(public)/privacy/page.tsx`, `terms/page.tsx`; the `legal.*` message keys (new keys plus the specific sentence edits listed in section 9.4); `GO-LIVE.md`; `.env.example`; `docs/CONVENTIONS.md` (env vars, the "ads and featured never change provenance" sentence under rule 1, and the money/ads rules); a small messages parity test (`src/lib/messages.parity.test.ts`) covering the new blocks below and `legal.*`. |

**Message files** (`messages/en.json`, `messages/ar.json`) are edited by all three. Each builder adds **only its own new top-level blocks at a fixed position** (both languages, same keys, same commit):

| Builder | New top-level blocks | Insert immediately after |
|---|---|---|
| A | `ads`, `adminAds` | the `properties` block |
| B | `featured`, `adminPayments`, `adminPrices` | the `market` block |
| C | none (edits `legal.*` only) | n/a |

### 3.2 Contracts between builders (names are binding; code is theirs)
- **A ⇄ B share nothing but the message files and the schema file** (different models; migrations are independent, so their order does not matter). A never reads prices from settings (the admin types the agreed price on each campaign); B's prices page lists the ad rate card only as reference numbers.
- **B uses align-4's `ownsListing(actor, listing)`** from `src/lib/listings/` as the single ownership rule for who may open a checkout. It does not re-implement ownership.
- **B's settings keys** (text values in `SiteSetting`): `price.featured.owner` (default `3.000`), `price.featured.agency` (`6.000`), `featured.days` (`30`), and the ad rate card `price.ad.homeBand` (`60.000`), `price.ad.marketSidebar` (`35.000`), `price.ad.propertyBelow` (`45.000`), `price.ad.neighborhoodSponsor` (`30.000`). Missing row = the default in code. Values are validated as an amount with at most 3 decimals (> 0, ≤ 10000.000) or, for `featured.days`, a whole number 1-365. Changing a price affects **future** checkouts only; every `Payment` stores the amount and days it actually charged.
- **The cap is a constant, not a setting:** `MAX_FEATURED_PER_PAGE = 3` in `src/lib/featured.ts`, with a test.

### 3.3 Recommendation: run `ui-designer` first
Yes — this build has new screens: the three (four) ad slots at phone (390 px) and laptop (1440 px) widths, the "Featured" card treatment, the "Feature this listing" page and result page, `/admin/ads`, `/admin/payments`, `/admin/settings/prices`. Run `ui-designer` (English + Arabic, phone + laptop) before A and B start. `Agents/docs/design-standards.md` applies (44 px targets, destructive actions separated, signifiers). Honesty requirement to give the designer: an ad or featured label must be **visible text, never colour or an icon alone**; an ad must never look like part of the financial figures next to it.

### 3.4 Coordination on the privacy and terms pages (four builds touch them this round)
- **align-4 A** adds `collectOwner`, edits `collectEnquiry`, `shareBody`, terms `listingsBody`, `enquiry.consent`.
- **align-5 C** edits `collectSavedSearches` and the retention line.
- **align-7 B** adds `collectStats`, **shown only when stats are configured**.
- **This build's C is last.** It adds new keys and makes only the specific sentence edits in section 9.4, then re-reads both pages end to end and confirms nothing contradicts anything else (for example the old "Phone numbers of private individuals are never shown publicly" sentence must already be gone). It sets "Last updated" on **both** pages, in **both** languages, to the build date. It does not touch `collectStats` or `collectOwner`.

## 4. Screens

Everywhere: phone = 390 px, laptop = 1440 px. Tap targets ≥ 44 px. Errors sit under the box that caused them and name it. Spacing and alignment use logical properties only (`ms-/me-/ps-/pe-/text-start`); the only `rtl:` uses are glyph mirroring and Arabic type size (rule 4). Navigation through `src/i18n/navigation.ts` (rule 5). **Money: `formatOMR` (3 decimals), Latin digits in Arabic, wrap in `dir="ltr"` where it sits inside Arabic text.** Loading states: skeletons or nothing per standards §9, and for ads the `Suspense` fallback is `null` (no placeholder box).

### 4.1 Build A — Ads

**A1. The `AdSlot` component** (`src/components/ads/AdSlot.tsx`, server component). Props: slot, optional neighbourhood id. It looks up **at most one** campaign that is: switched on, `startsAt <= now < endsAt`, in this slot, and — for the two per-area slots — for this neighbourhood exactly (no fallback to another area's ad). **No campaign = it renders nothing at all** (no empty box, no "advertise here" text, no gap). When there is one it renders:
- A visible label at the top-start corner, always: **"Ad · إعلان"** (both languages in both page languages, `ads.label`), ≥ 12 px (`rtl:text-sm`), solid contrast, not colour alone.
- The banner image (Arabic image on `/ar` if one was uploaded, else the English one) inside a link to `/api/ads/<id>/click`, opening in a new tab with `rel="sponsored nofollow noopener noreferrer"`. Alt text from the campaign (`altAr` on `/ar` falling back to `altEn`); the link has an accessible name `ads.linkHint`. A fixed aspect ratio box (no layout jump once the image loads), `object-cover`, rounded like other cards, and visually **separate** from surrounding figures (its own card edge and spacing; never inside a data card).
- After rendering, one view is counted (see A4). No script tag, no third-party request: the only network calls are same-origin (`/api/images/...`, `/api/ads/.../click`).

**A2. The four places** (each is one `AdSlot` insertion):
1. **Home band** — full-width band on `/` between the neighbourhood shortcuts and the trends section. Artwork 1600×400 (4:1). Wrapped in `<Suspense fallback={null}>` so the static page shell is not held up.
2. **Market sidebar** — on `/market`: at ≥ 1024 px a right-hand column beside the price-trend card and neighbourhood cards; below 1024 px a full-width block after the price-trend card. **When there is no campaign the page is exactly as today (single column).** Artwork 600×500 (6:5). Coordinate with align-5 A's edit of this file (rebase onto it).
3. **Below the property's financial block** — on `/properties/<id>`, in the right column directly below `FinancialAnalysisCard`, above the AI analyst. Per **neighbourhood** (the ad sold "per area" is shown only on properties in that area). Artwork 1200×300 (4:1). Must be visibly separate from the financial card with a clear gap and its label (house rule 1: an ad next to numbers must not be mistaken for a number's source).
4. **Neighbourhood sponsor** (build it if it takes under an hour; it is the same component) — a slim strip under the heading of `/market/<slug>`, one sponsor only per neighbourhood, artwork 1200×200 (6:1), label "Ad · إعلان" plus "By {advertiser}" (`ads.by`).

**A3. Admin — `/[locale]/admin/ads`** (admin only, `enforceAdminPage()` first line)
- **List:** one card per campaign (cards on phone, table from 640 px up): advertiser, slot, area (if any), dates, a status word — **Scheduled / Live / Ended / Paused** (worked out from dates + switch), views, clicks, click rate (clicks ÷ views as a percentage; "—" when views are 0), the agreed price if entered. "New campaign" button.
- **Create / edit form:** advertiser name; slot (4 choices, each showing its recommended artwork size and where it appears); neighbourhood (required for the property-page and neighbourhood-sponsor slots, hidden otherwise); link address (**https only**); alt text English (required) and Arabic (optional); image English (required on create) and image Arabic (optional; JPEG/PNG/WebP, ≤ 2 MB each, checked by the file's bytes); start and end date-times; agreed price in OMR (optional, `Decimal(12,3)`, for the owner's own records and the monthly report); "Switched on" toggle. A live preview exactly as visitors would see it (label included).
- **Refusals with plain messages:** overlapping campaigns in the **same slot (and same neighbourhood for per-area slots)** — "founding partner: their slot is theirs alone"; end before start; a link that is not https; a file that is not a real image or is over 2 MB; missing required fields.
- **Pause / resume** button (a stand-alone, separated control, ≥ 44 px). **No delete** (numbers are kept).
- **Report (per campaign):** totals plus a month-by-month table of views and clicks (from the daily counts), and a plain-text block the owner can copy into an email or WhatsApp: advertiser, slot, period, views, clicks, click rate, with the sentence "Views are counted when the page loads; they are approximate." Both languages.
- New "Ads" card on the admin home (count of live campaigns).

**A4. Click and view counting (no tracking)**
- **Click route** `GET /api/ads/<id>/click`: looks the campaign up **by id only**; the destination is **only** the stored `linkUrl` (never taken from the address bar, so it cannot be turned into an open redirect); the link is re-checked as `https:` at redirect time as well as at save time; responds `302` with `Cache-Control: no-store` and `X-Robots-Tag: noindex`. It **always redirects** if the campaign exists (even when the click is not counted); an unknown id gives a plain 404. A click is counted only if the campaign is currently live and passes the rate limit below. No cookie is set, no IP or user agent is stored.
- **Views:** counted server-side, after the page is sent (use Next's `after()`; read `node_modules/next/dist/docs/` to confirm its shape in this version), skipping requests whose user agent looks like a crawler or link-preview bot (`bot|crawler|spider|preview|facebookexternalhit|whatsapp`). Counted once per visitor address per campaign per 10 minutes so a refresh loop does not inflate the numbers. Counts are kept per **Oman day** (UTC+4) in `AdDailyStat`; increments are a single atomic database statement (never read-then-write).
- Robots: align-7 blocks `/api/` for crawlers; `rel="sponsored nofollow"` keeps links from passing search ranking.

### 4.2 Build B — Featured listings and checkout

**B1. Featured treatment in search — `/properties`**
- Featured listings appear in a **top block of at most 3**, then everything else in today's order (newest first). Only listings that **match the visitor's filters** and are **live** (`ACTIVE`) with `featuredUntil` in the future qualify. A featured listing that is not in the newest 60 is still found (separate query), and a listing never appears twice.
- If more than 3 qualify, which 3 lead **rotates every hour**: candidates are ordered by a stable hash of (listing id + current UTC hour), so it is fair between advertisers, deterministic (testable) and needs no random call. The rotation is a pure function `pickFeatured(candidates, hourStamp, max)`.
- Each featured card shows a visible **"Featured · مميز"** label (`featured.label`) over the photo at the top-start corner, plus a subtle ring; it is otherwise the **same card** — the `ProvenanceBadge` and every figure stay exactly as for any listing. Nothing about featuring changes provenance, confidence, the investment score, valuation or the AI analyst (house rule 1; tested, see section 7).
- Not shown on `/properties/compare`, favourites, the sitemap or the property page in this build (out of scope) — those keep their current ordering and look.

**B2. "Feature this listing" — `/[locale]/feature/[listingId]`** (signed-in only; shared by owners and agencies)
- Reached from a **"Feature this listing"** button in the owner's and agency's listing action panel (button visible only for a live listing).
- Guard first: signed in, and `ownsListing(actor, listing)` — otherwise the **same standard not-found page** as for a missing id (not-yours and missing must be indistinguishable). Admin-entered listings (no owner) cannot be featured here; the admin does it by hand (B4).
- Shows: the listing's title and cover; **"Featured for 30 days"**; the price for this seller (owner price if the listing has no agency, agency price otherwise), formatted with `formatOMR` (e.g. "OMR 3.000" / "3.000 ر.ع."); the three plain-words bullets (what you get, the 3-per-page cap, "doesn't change how your listing is reviewed"); if the listing is already featured, the current end date and "Paying adds 30 more days after that".
- **When the gateway keys are not set** (`isThawaniEnabled()` false): no pay button. The page shows the message **"Online payments aren't switched on yet — contact us to feature your listing."** plus the contact line with the site's contact email (`getPrivacyContactEmail()`), so the seller can arrange a bank transfer. Nothing throws; nothing is created.
- **When keys are set:** button **"Pay OMR 3.000 by card"**. Pressing it runs a server action that (1) re-checks sign-in and ownership, (2) checks the listing is `ACTIVE` and not a sample record, (3) reads the price and days **from settings on the server** (the browser sends only the listing id), (4) creates a `Payment` in `PENDING`, (5) creates the Thawani session and stores its id on the payment, and (6) returns the Thawani pay-page address; the page then **navigates with script** (`window.location.assign`). It must not be an HTML form post (CSP `form-action 'self'`). A second press within 10 minutes for the same listing by the same person **reuses the open session** rather than creating another.
- Line under the button: "You'll be taken to Thawani's secure payment page. We never see your card details."

**B3. Result — `/[locale]/feature/result?p=<paymentId>`** (signed-in; must be the payer, else standard not-found)
Reads the state **from our database**, never from the address. States: **Paid** ("Payment received. Your listing is featured until {date}."), **Pending** ("We haven't received confirmation of your payment yet. This can take a minute." + "Check again" button, which runs a rate-limited gateway lookup), **Not completed** ("The payment wasn't completed. If money left your account, contact us and quote reference {ref}."). Always shows a short reference and "Back to my listing".

**B4. Admin**
- **`/admin/payments`** (guard first): payments newest first (cards on phone), with date, listing, payer, method (Card / Bank transfer by hand), amount (`formatOMR`), status pill, reference; filter by status; per pending payment a **"Re-check with gateway"** button; a **Security log** section listing refused or suspicious confirmation events (see section 5) with counts; a badge on the admin home card when there are flagged events in the last 7 days.
- **Feature by hand** (for direct bank-transfer deals): pick a live listing (linked from `admin/listings/[id]`), days (default 30), the amount received (may be 0.000 for a gift), an invoice/reference note, Confirm. It records a `Payment` with method "by hand", status paid, and extends `featuredUntil` exactly as a paid card payment would. Also **"Stop featuring"** on a listing (sets it to now; recorded in the log with a reason box). Both are admin-only, role-checked in the action, rate-limited.
- **`/admin/settings/prices`**: the seven values in 3.2, each as an amount box with the current value, "Last changed", Save; saving is admin-only and logged. Says in plain words that changes apply to future payments only.

### 4.3 Build C — Privacy, terms, go-live notes
No new screens. Exact wording in section 9.4; owner steps in section 10.

## 5. Security behaviour (Build B's payment path — the part that needs the most care)

Rule: **never trust the browser; verify with the gateway; store the gateway reference uniquely against replay.** Built on what Thawani actually offers (the session lookup; see section 2).

1. **What the browser is allowed to say:** only *our own* payment id (an unguessable cuid) in the return address. It carries no amount, no status, no session id, no "paid=true". Nothing in the address decides an outcome.
2. **Return route `GET /api/payments/thawani/return?p=<id>&l=<locale>`:** rate-limited; loads the `Payment` by id; if not found → event `UNKNOWN_PAYMENT`, redirect to a generic result. If found and already `PAID` → no work, redirect (a refresh or replay is harmless). If `PENDING` (or `FAILED`, in case money was taken late) → **asks Thawani** for the session stored on **our** row with the secret key. Only the exact value `paid` counts, as in Dukkani.
3. **Cross-checks on the gateway's answer** (verify in the sandbox which fields the lookup returns; require every one that is present, and log an "unverifiable" event if the amount field is missing): the amount equals our stored amount in baisa; the `client_reference_id` equals our payment id; currency OMR. Any mismatch → **not paid**, event `AMOUNT_MISMATCH` / `REFERENCE_MISMATCH`, payment left as is for the admin to investigate.
4. **Atomic, once-only effect:** the switch to paid is a single conditional update ("set paid **where** status is still pending or failed"); only the caller whose update changed a row extends `featuredUntil` (from the later of now and the current end, by the days stored on the payment) **in the same database transaction**. Two simultaneous returns, a double-click, a refresh, or a replayed address therefore feature the listing **once**. A refused or repeated attempt writes an event (`ALREADY_CONFIRMED`, `NOT_PAID`, ...).
5. **Gateway reference is unique:** `Payment.gatewaySessionId` carries a **unique** index (nullable for by-hand payments; Postgres allows many nulls). One Thawani session can never be attached to two payments, even through a bug or an admin mistake.
6. **Raw payload kept:** the last gateway answer is stored as JSON on the payment (and the confirming answer is kept). The builder checks in the sandbox whether that answer contains card or personal fields; if it does, drop exactly those fields before storing and say so in the report. **Card details never reach our server** (hosted page) and are never stored or logged.
7. **Secrets:** `THAWANI_API_KEY` is used only in server-only code (`import "server-only"`) and is never logged, returned, or put in a page. The publishable key appears only inside the pay-page address, as Thawani designs it. Return and cancel addresses are built from `AUTH_URL`, **not** from the request's Host header.
8. **Amounts in whole baisa from the stored decimal by integer maths** (string → integer), never floating point; a test proves 3.000 → 3000, 6.000 → 6000, 0.001 → 1, and that odd inputs are refused.
9. **Money is set on the server only:** the seller sends a listing id and nothing else. Price and days are read from settings at that moment and frozen on the payment.
10. **Dormant means dormant:** with keys unset, the session route and the return route refuse to do anything (return route redirects to the result page; no lookup is made), and `/api/health` (admin) shows `payments: "dormant"`.
11. **Admin actions:** `requireAdmin()` in every action (rule 7) plus `enforceAdminPage()` on every page; hand-featuring and un-featuring are written to `PaymentEvent`.
12. **No CSP change**, verified with `curl -I` against a running server and by clicking through the sandbox checkout in a real browser (a script navigation to Thawani must work; a CSP violation in the console is a fail).

**Events log (`PaymentEvent`)** — every refused or unusual confirmation is stored, not only printed: kinds `CHECKOUT_STARTED`, `SESSION_CREATE_FAILED`, `CONFIRMED`, `ALREADY_CONFIRMED`, `NOT_PAID`, `AMOUNT_MISMATCH`, `REFERENCE_MISMATCH`, `UNKNOWN_PAYMENT`, `LOOKUP_FAILED`, `RATE_LIMITED`, `MANUAL_FEATURE`, `MANUAL_UNFEATURE`, `PRICE_CHANGED`. Each has the payment id when known, a short detail (no secrets, no card data) and a time. Logging of unknown-id hits is capped per visitor address (20 per hour) so the log cannot be flooded. Events also go to the server log (and Sentry when on) without secrets.

### Rate limits (per process, in-memory as everywhere; `REDIS_URL` seam still not wired — accepted)

| Action | Limit | Key |
|---|---|---|
| Start checkout | 10/hour per user and 5/hour per listing | `feature:start:user:<id>`, `feature:start:listing:<id>` |
| "Check again" on the result page | 20/hour per user | `feature:check:user:<id>` |
| Return route | 30 per 10 minutes per visitor address (over the limit: redirect to the result page, no lookup) | `feature:return:ip:<ip>` |
| Unknown-id events written | 20/hour per visitor address | `feature:unknown:ip:<ip>` |
| Admin money / ads / price actions | 120/min per admin | `admin:user:<id>` (the existing pattern) |
| Ad image upload | 30/hour per admin | `ads:upload:user:<id>` |
| Ad click counted | 1 per campaign per visitor address per minute (redirect always happens) | `ad:click:<campaignId>:ip:<ip>` |
| Ad view counted | 1 per campaign per visitor address per 10 minutes | `ad:view:<campaignId>:ip:<ip>` |

Refusals are in plain words in both languages (`featured.errors.rateLimited`); no dead buttons.

## 6. The data touched, in plain terms

- **Each listing can be "featured until" a date.** One new optional date on `Listing` (`featuredUntil`). Featured status is worked out by comparing that date with now — nothing needs a scheduled job to switch it off.
- **A new payments record**, one row per attempt to pay for featuring: which listing, who paid (their account), how (card via Thawani / by hand), the amount in OMR (`Decimal(12,3)`, currency OMR), how many days it buys, its status (pending / paid / failed), the gateway's session reference (unique), the gateway's last answer (JSON), the time paid, and for by-hand entries who recorded it and a note. **Card details are never stored — they are entered on Thawani's page only.**
- **A security/event log** (`PaymentEvent`) of refused or unusual payment confirmations and admin money actions.
- **Ad campaigns:** advertiser name, slot, optional neighbourhood, link, alt text (EN/AR), image path(s) under `DATA_DIR/ads/<campaignId>/`, start and end times, on/off, an optional agreed price (`Decimal(12,3)`), created time.
- **Ad counts, per Oman day per campaign:** views and clicks as plain totals (`AdDailyStat`, unique per campaign + day). No person, address, cookie or device is stored. (This deviates from the build plan's "impressions/clicks counters on the campaign" wording on purpose: daily rows are what make the promised monthly report to advertisers possible; totals are summed. Say so in the report.)
- **Prices** live in the existing `SiteSetting` table (created by align-4 C), seven keys (3.2).
- **Additive only.** Nothing is removed or renamed. Two real migration files (house rule 11; never `db push`): A `add_ad_campaigns`, B `add_featured_listings_and_payments`. All new money columns are `Decimal @db.Decimal(12,3)`; Decimals are turned into strings before they reach a client component (rule 2).
- **Files:** ad artwork on the `/data` volume (`ads/...`), a single copy not covered by database backups.

## 7. Tests required (all inside `npm test`, standards §7)

The app's core guarantee is provenance labels and the AI leash; paid placement sits right beside labelled data, so **this feature touches the guarantee and the tests below are mandatory**.

**B — payments and featuring**
- Baisa maths: 3.000→3000, 6.000→6000, 0.001→1, refuses negative / NaN / more than 3 decimals.
- Price reader: defaults when no row; reads settings; rejects bad values; owner vs agency price chosen from `agencyId`.
- `pickFeatured`: never more than 3; only non-expired; rotation is stable within an hour and changes across hours; deterministic.
- Search ordering (database-backed, test database): featured first, cap 3, expired ignored, non-ACTIVE never featured even if `featuredUntil` is set, filters respected, a featured listing outside the newest 60 still appears, no duplicates.
- **Confirm path with a fake gateway (inject the lookup):** paid → listing extended by the payment's days exactly once; **replay** (confirm twice) → extended once, second call logs `ALREADY_CONFIRMED`; **two simultaneous confirms** → once; not-paid → nothing changes; **tampered** — wrong amount, wrong reference, unknown payment id, another user's payment id, missing session id — each refused, nothing extended, event written; unique session id enforced by the database (a second payment with the same session fails); a late-paid `FAILED` payment is honoured once; dormant (keys unset) → no lookup made.
- **Honesty:** after a paid confirm and after hand-featuring, the listing's `provenance`, `confidence`, `status` and price are unchanged; a scan test asserts that `src/lib/db/valuations.ts` and `src/lib/ai/**` never mention `featuredUntil`, `AdCampaign` or `Payment` (paid placement can never leak into estimates or the AI analyst).
- Ownership: an owner/agency that does not own the listing cannot start a checkout; admin-only hand-feature refuses a non-admin.

**A — ads**
- Slot selection (pure): no campaign → nothing; off/expired/not started → nothing; wrong slot or wrong neighbourhood → nothing; per-area slots never fall back to another area; picks the right language image with fallback.
- **The view model always carries the "Ad · إعلان" label whenever it returns something** (test the pure function that `AdSlot` renders from).
- Overlap refusal in the same slot/area; end-before-start refused; link validator accepts only `https:` (rejects `http:`, `javascript:`, `data:`, credentials in the URL, over-long).
- Click route: redirects to the **stored** link only (a `?url=` in the address is ignored); unknown id → 404; a paused campaign still redirects but is not counted; repeated clicks from one address within a minute count once; no cookie set.
- Counting: atomic increments; daily bucket uses the Oman day; crawler user agents are not counted.
- Upload: a real JPEG/PNG/WebP accepted; a renamed non-image refused by its bytes; a 2.1 MB file refused; SVG/GIF refused; path stays inside `DATA_DIR`.

**C**
- Messages parity test: every key in the new `ads`, `adminAds`, `featured`, `adminPayments`, `adminPrices` blocks and in `legal.*` exists in both languages.
- A test that the privacy strings no longer contain the bare claim without the "no advertising network" qualification (guards against a merge silently restoring the old sentence).

## 8. What is explicitly OUT of scope

- **Making agency plan tiers (FREE/PREMIUM/BUSINESS) chargeable**, and any subscription/recurring billing. Tiers stay granted by hand (`/admin/agencies`); the free-launch switch (align-4 C) is untouched.
- **Charging for ads online.** Ads are sold directly and invoiced by bank transfer, per the decision file; no self-serve ad purchase, no ad-network, no auction, no third-party ad script of any kind.
- **Refunds and payment reversal in code.** A refund is done by the owner in Thawani's dashboard; the admin can stop featuring by hand. No automatic refund flow, no webhook receiver.
- **Bank-transfer requests from the site** (a "request to feature" form). The not-switched-on page shows a contact line only.
- Featuring anything other than a listing (no featured agencies, no featured neighbourhoods); "top of the category" or homepage carousels; featured badges on the property page, compare, favourites or the sitemap.
- Invoices/VAT receipts generated by the site; a customer payment history page; email receipts (email notifications are their own backlog item).
- Targeting ads by search terms, user, or behaviour; ad A/B tests; ad scheduling by weekday or hour; deleting campaigns; automatic ad-image resizing; image dimension enforcement (recommended sizes are shown, not enforced).
- Visitor-stats tool (align-7) and any third-party script or cookie.
- PayTabs or any second gateway.
- Delete-my-account / download-my-data (still not built anywhere; standards §6 flag carried forward from align-4; payment records now make it slightly more relevant).
- Changing the CSP, the SMS provider, or the owner sign-up rules.

## 9. Bilingual note and exact strings

Everything ships in `messages/en.json` and `messages/ar.json` in the same commit (rule 3). **Money always through `formatOMR`; Latin digits in Arabic; wrap prices, dates, references and emails in `dir="ltr"` inside Arabic sentences.** Arabic plurals use proper Arabic categories (the app currently gets "1 غرف" wrong; do not copy that). Dates use the app's existing Latin-digit date formatting. Status words go through translations; never a raw `PENDING`. The two labels are deliberately identical in both language files (bilingual by design: the owner asked for "Featured / مميز" and "Ad / إعلان").

### 9.1 Build A — `ads`

| Key | English | Arabic |
|---|---|---|
| `ads.label` | Ad · إعلان | Ad · إعلان |
| `ads.by` | By {name} | من {name} |
| `ads.imageAltFallback` | {name} — advertisement | {name} — إعلان |
| `ads.linkHint` | Advertisement from {name}. Opens the advertiser's website in a new tab. | إعلان من {name}. يفتح موقع المعلن في تبويب جديد. |

### 9.2 Build A — `adminAds` (admin desk, both languages required; builders may add further obvious labels in both languages)

| Key | English | Arabic |
|---|---|---|
| `adminAds.title` | Ads | الإعلانات |
| `adminAds.dashHint` | Direct-sold banners: create, pause, and report. | لافتات تُباع مباشرةً: إنشاء وإيقاف وتقارير. |
| `adminAds.new` | New campaign | حملة جديدة |
| `adminAds.status.scheduled` | Scheduled | مجدولة |
| `adminAds.status.live` | Live | نشطة |
| `adminAds.status.ended` | Ended | منتهية |
| `adminAds.status.paused` | Paused | متوقفة |
| `adminAds.slot.HOME_BAND` | Home page band | شريط الصفحة الرئيسية |
| `adminAds.slot.MARKET_SIDEBAR` | Market page sidebar | الشريط الجانبي لصفحة السوق |
| `adminAds.slot.PROPERTY_BELOW_FINANCIALS` | Below a property's money figures (per area) | أسفل الأرقام المالية للعقار (لكل منطقة) |
| `adminAds.slot.NEIGHBORHOOD_SPONSOR` | Neighbourhood sponsor (per area) | راعي المنطقة (لكل منطقة) |
| `adminAds.size` | Recommended artwork: {size} pixels | مقاس التصميم الموصى به: {size} بكسل |
| `adminAds.views` | Views | مرات العرض |
| `adminAds.clicks` | Clicks | النقرات |
| `adminAds.clickRate` | Click rate | نسبة النقر |
| `adminAds.pause` | Pause | إيقاف مؤقت |
| `adminAds.resume` | Resume | استئناف |
| `adminAds.save` | Save campaign | حفظ الحملة |
| `adminAds.report.title` | Report | التقرير |
| `adminAds.report.note` | Views are counted when the page loads; they are approximate. | تُحتسب مرات العرض عند تحميل الصفحة، وهي أرقام تقريبية. |
| `adminAds.report.copy` | Copy report | نسخ التقرير |
| `adminAds.errors.overlap` | Another campaign already has this slot for these dates. A slot belongs to one advertiser at a time. | توجد حملة أخرى في هذا الموضع خلال هذه الفترة. يعود الموضع لمعلن واحد في كل مرة. |
| `adminAds.errors.dates` | The end must be after the start. | يجب أن يكون تاريخ النهاية بعد البداية. |
| `adminAds.errors.link` | The link must start with https:// . | يجب أن يبدأ الرابط بـ https:// . |
| `adminAds.errors.image` | The image must be a real JPEG, PNG or WebP file of 2 MB or less. | يجب أن تكون الصورة بصيغة JPEG أو PNG أو WebP فعلية وبحجم 2 ميغابايت أو أقل. |
| `adminAds.errors.neighborhood` | Choose the neighbourhood this slot is for. | اختر المنطقة التي يخصها هذا الموضع. |
| `adminAds.errors.rateLimited` | Too many changes. Try again in a minute. | تغييرات كثيرة. حاول بعد دقيقة. |

### 9.3 Build B — `featured`

| Key | English | Arabic |
|---|---|---|
| `featured.label` | Featured · مميز | Featured · مميز |
| `featured.days` | {count, plural, one {# day} other {# days}} | {count, plural, one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} |
| `featured.checkout.title` | Feature this listing | تمييز هذا الإعلان |
| `featured.checkout.lede` | A featured listing is shown above other listings in matching searches, marked "Featured", for {period}. | يظهر الإعلان المميز فوق الإعلانات الأخرى في نتائج البحث المطابقة، بعلامة «مميز»، لمدة {period}. |
| `featured.checkout.forListing` | Listing: {title} | الإعلان: {title} |
| `featured.checkout.total` | Total | الإجمالي |
| `featured.checkout.bullet1` | Shown first in matching searches. At most 3 featured listings appear on one results page. | يظهر أولًا في نتائج البحث المطابقة. تظهر 3 إعلانات مميزة كحد أقصى في صفحة النتائج الواحدة. |
| `featured.checkout.bullet2` | Marked "Featured" so buyers know it is a paid placement. | يحمل علامة «مميز» ليعرف المشترون أنه موضع مدفوع. |
| `featured.checkout.bullet3` | It doesn't change how your listing is reviewed, or the labels on its figures. | لا يغيّر طريقة مراجعة إعلانك ولا العلامات الموضحة على أرقامه. |
| `featured.checkout.alreadyFeatured` | This listing is already featured until {date}. Paying adds {period} after that. | هذا الإعلان مميز حتى {date}. الدفع يضيف {period} بعد ذلك. |
| `featured.checkout.pay` | Pay {price} by card | ادفع {price} بالبطاقة |
| `featured.checkout.redirectNote` | You'll be taken to Thawani's secure payment page. We never see your card details. | ستنتقل إلى صفحة الدفع الآمنة الخاصة بثواني. لا نطّلع على بيانات بطاقتك. |
| `featured.checkout.notSwitchedOn` | Online payments aren't switched on yet — contact us to feature your listing. | الدفع الإلكتروني غير مفعّل بعد — تواصل معنا لتمييز إعلانك. |
| `featured.checkout.contact` | Email {email} with the name of your listing and we'll arrange it by bank transfer. | راسلنا على {email} مع اسم إعلانك وسنرتّب الأمر عبر التحويل البنكي. |
| `featured.checkout.notLive` | Only live listings can be featured. Once this listing is approved, come back here. | لا يمكن تمييز سوى الإعلانات المنشورة. عند اعتماد هذا الإعلان، عُد إلى هنا. |
| `featured.checkout.button` | Feature this listing | تمييز هذا الإعلان |
| `featured.result.paid` | Payment received. Your listing is featured until {date}. | تم استلام الدفع. إعلانك مميز حتى {date}. |
| `featured.result.pending` | We haven't received confirmation of your payment yet. This can take a minute. | لم نتلقَّ تأكيد الدفع بعد. قد يستغرق ذلك دقيقة. |
| `featured.result.checkAgain` | Check again | تحقق مرة أخرى |
| `featured.result.failed` | The payment wasn't completed. If money left your account, contact us and quote reference {ref}. | لم تكتمل عملية الدفع. إذا خُصم مبلغ من حسابك، تواصل معنا واذكر الرقم المرجعي {ref}. |
| `featured.result.reference` | Reference {ref} | الرقم المرجعي {ref} |
| `featured.result.back` | Back to my listing | العودة إلى إعلاني |
| `featured.errors.rateLimited` | Too many attempts. Please wait a while and try again. | محاولات كثيرة. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى. |
| `featured.errors.startFailed` | We couldn't start the payment. Nothing was charged. Please try again. | تعذّر بدء عملية الدفع. لم يُخصم أي مبلغ. حاول مرة أخرى. |
| `featured.errors.wrongState` | This listing can't be featured right now. Refresh the page and try again. | لا يمكن تمييز هذا الإعلان الآن. حدّث الصفحة وحاول مرة أخرى. |

(`{period}` is `featured.days` filled with the days count; `{price}` comes from `formatOMR`; the reference is the last 8 characters of the payment id, upper case. The reference contains only letters and digits, shown `dir="ltr"`.)

### 9.4 Build C — privacy and terms (same build; also set both pages' "Last updated" to the build date in both languages)

**Privacy — `legal.privacy.collectTechnical`:** keep the existing sentences and replace only the sentence "We do not use advertising or tracking cookies." with:
- EN: We do not use advertising or tracking cookies, and no advertising network or third-party advertising script runs on this site.
- AR: لا نستخدم ملفات تعريف ارتباط (كوكي) للإعلانات أو للتتبع، ولا تعمل على هذا الموقع أي شبكة إعلانات ولا أي برنامج إعلاني تابع لجهة خارجية.
(C matches the existing Arabic sentence in `ar.json` and replaces that sentence, leaving the rest of the line untouched.)

**Privacy — new `legal.privacy.collectAds`** (added to `collectKeys`, immediately before `collectTechnical`):
- EN: Advertising — we sell the advertisements on this site directly to advertisers. No advertising network is involved and no third-party advertising script runs here. Ads are always marked "Ad". We count how many times each ad is shown and how many times it is clicked. These are totals only: they are not linked to your account, and we do not keep your address, device or browsing history for this. When you click an ad you leave this site for the advertiser's own website, which has its own privacy rules.
- AR: الإعلانات — نبيع الإعلانات على هذا الموقع مباشرةً للمعلنين. لا توجد أي شبكة إعلانات ولا يعمل هنا أي برنامج إعلاني تابع لجهة خارجية. وتُوسَم الإعلانات دائمًا بكلمة «إعلان». نحتسب عدد مرات عرض كل إعلان وعدد النقرات عليه، وهي أعداد إجمالية فقط لا ترتبط بحسابك، ولا نحتفظ لهذا الغرض بعنوانك أو جهازك أو سجل تصفحك. وعند النقر على إعلان تنتقل إلى موقع المعلن الذي له سياسة خصوصية خاصة به.

**Privacy — new `legal.privacy.collectPayments`** (added to `collectKeys`, right after `collectAds`):
- EN: Payments — when you pay to feature a listing, you pay on the payment gateway's own secure page (Thawani Pay, once it is switched on). Your card details are entered there and never reach us or our server. We keep a record of the payment: the listing it was for, the amount, its status, the gateway's reference number and the gateway's confirmation of it, and your account. Payments arranged by bank transfer are recorded the same way, without any card details.
- AR: المدفوعات — عند الدفع لتمييز إعلان، تدفع على صفحة الدفع الآمنة الخاصة ببوابة الدفع (ثواني باي، بعد تفعيلها). تُدخل بيانات بطاقتك هناك ولا تصل إلينا ولا إلى خادمنا إطلاقًا. نحتفظ بسجل للدفعة: الإعلان الذي دُفعت من أجله، والمبلغ، وحالتها، والرقم المرجعي لدى بوابة الدفع وتأكيد البوابة لها، إضافةً إلى حسابك. وتُسجَّل الدفعات المرتّبة بالتحويل البنكي بالطريقة نفسها دون أي بيانات بطاقة.

**Privacy — `shareBody`, append one sentence:**
- EN: We do not share payment records with anyone except the payment gateway that processes them, or where the law requires it.
- AR: لا نشارك سجلات الدفع مع أي جهة سوى بوابة الدفع التي تعالجها، أو حيث يوجب القانون ذلك.

**Privacy — `retentionBody`, append one sentence** (after align-5 C's edit is merged; do not disturb its wording):
- EN: Payment records are kept for as long as accounting and the law require.
- AR: تُحفظ سجلات الدفع للمدة التي تتطلبها المحاسبة والقانون.

**Terms — new pair `adsTitle` / `adsBody`** (added to the page's `sections` list right after `listingsTitle/listingsBody`):
- `legal.terms.adsTitle` — EN: Advertising, featured listings and payments · AR: الإعلانات والإعلانات المميزة والمدفوعات
- `legal.terms.adsBody` —
  - EN: Some placements on this site are paid. Ads are marked "Ad" and featured listings are marked "Featured". Paying for a placement does not change how a listing is reviewed, the source label on any figure, or any estimate or score we show, and it is not an endorsement by us. A featured listing is shown first in matching searches for the paid period (at most 3 featured listings appear on one results page), and only while the listing is live. Fees are shown in Omani rials before you pay. We may remove any ad or listing that breaks these terms or misleads people. Fees are not refunded when a listing is removed for breaking these terms. If a payment was taken but the featuring did not start, contact us and we will fix it or refund you.
  - AR: بعض المواضع على هذا الموقع مدفوعة. تُوسَم الإعلانات بكلمة «إعلان» وتُوسَم الإعلانات المميزة بكلمة «مميز». الدفع مقابل موضع لا يغيّر طريقة مراجعة الإعلان، ولا علامة المصدر على أي رقم، ولا أي تقدير أو درجة نعرضها، وهو ليس تزكية منا. يظهر الإعلان المميز أولًا في نتائج البحث المطابقة طوال المدة المدفوعة (بحد أقصى 3 إعلانات مميزة في صفحة النتائج الواحدة)، وذلك فقط ما دام الإعلان منشورًا. تُعرض الرسوم بالريال العُماني قبل الدفع. يحق لنا إزالة أي إعلان أو عقار يخالف هذه الشروط أو يضلل الناس. لا تُردّ الرسوم عند إزالة إعلان لمخالفته هذه الشروط. وإذا خُصم مبلغ ولم يبدأ التمييز، تواصل معنا وسنعالج الأمر أو نردّ لك المبلغ.
  (The last two sentences state a refund position the owner has not yet confirmed — see open question 2. If the owner changes it, C edits both languages.)

Both pages keep the existing "template pending professional review" notice. Standing owner items carried from align-4: the contact address is still a personal Hotmail (`PRIVACY_CONTACT_EMAIL`), and the lawyer review noted on the pages becomes more pressing now that the site takes money.

### 9.5 Build B — admin strings (`adminPayments`, `adminPrices`; builders may add further obvious labels in both languages)

| Key | English | Arabic |
|---|---|---|
| `adminPayments.title` | Payments and featuring | المدفوعات والتمييز |
| `adminPayments.dashHint` | Card payments, hand-featuring, and the security log. | مدفوعات البطاقات والتمييز اليدوي وسجل الأمان. |
| `adminPayments.method.THAWANI` | Card (Thawani) | بطاقة (ثواني) |
| `adminPayments.method.MANUAL` | Bank transfer, by hand | تحويل بنكي، يدويًا |
| `adminPayments.status.PENDING` | Waiting | بانتظار الدفع |
| `adminPayments.status.PAID` | Paid | مدفوعة |
| `adminPayments.status.FAILED` | Not completed | لم تكتمل |
| `adminPayments.recheck` | Re-check with gateway | إعادة التحقق لدى البوابة |
| `adminPayments.featureByHand` | Feature by hand | تمييز يدوي |
| `adminPayments.featureByHandHelp` | Use this after you have received a bank transfer. It works exactly like a paid card payment. | استخدم هذا بعد استلام التحويل البنكي. يعمل تمامًا مثل الدفع بالبطاقة. |
| `adminPayments.amountReceived` | Amount received (OMR) | المبلغ المستلم (ر.ع.) |
| `adminPayments.days` | Days | عدد الأيام |
| `adminPayments.invoiceNote` | Invoice or transfer reference | مرجع الفاتورة أو التحويل |
| `adminPayments.stopFeaturing` | Stop featuring | إيقاف التمييز |
| `adminPayments.securityLog` | Security log | سجل الأمان |
| `adminPayments.securityLogHelp` | Refused or unusual payment confirmations, such as a repeated confirmation or an amount that didn't match. | عمليات تأكيد دفع مرفوضة أو غير معتادة، مثل تأكيد مكرر أو مبلغ غير مطابق. |
| `adminPayments.gatewayOff` | Card payments are switched off (no gateway keys). Hand-featuring still works. | الدفع بالبطاقة متوقف (لا توجد مفاتيح للبوابة). التمييز اليدوي يعمل. |
| `adminPrices.title` | Prices | الأسعار |
| `adminPrices.help` | Changes apply to future payments only. Payments already made keep the price they were charged. | تسري التغييرات على الدفعات القادمة فقط. تحتفظ الدفعات السابقة بالسعر الذي حُسبت به. |
| `adminPrices.featuredOwner` | Featured listing — private owner (OMR) | إعلان مميز — مالك فرد (ر.ع.) |
| `adminPrices.featuredAgency` | Featured listing — agency, per listing (OMR) | إعلان مميز — وكالة، لكل إعلان (ر.ع.) |
| `adminPrices.featuredDays` | Days a featured listing lasts | عدد أيام التمييز |
| `adminPrices.adHomeBand` | Ad rate card — home band, per month (OMR) | تعرفة الإعلانات — شريط الرئيسية، شهريًا (ر.ع.) |
| `adminPrices.adMarketSidebar` | Ad rate card — market sidebar, per month (OMR) | تعرفة الإعلانات — الشريط الجانبي للسوق، شهريًا (ر.ع.) |
| `adminPrices.adPropertyBelow` | Ad rate card — below a property's figures, per month per area (OMR) | تعرفة الإعلانات — أسفل أرقام العقار، شهريًا لكل منطقة (ر.ع.) |
| `adminPrices.adNeighborhoodSponsor` | Ad rate card — neighbourhood sponsor, per month (OMR) | تعرفة الإعلانات — راعي المنطقة، شهريًا (ر.ع.) |
| `adminPrices.errors.invalid` | Enter an amount with up to 3 decimals, above zero. | أدخل مبلغًا أكبر من صفر بحد أقصى 3 خانات عشرية. |
| `adminPrices.saved` | Saved. | تم الحفظ. |

## 10. Owner steps for `GO-LIVE.md` (Build C writes them in plain English; the code cannot do these)

1. **Ads need no switch.** They appear when you create a campaign in `/admin/ads`. Before the first real ad: the `/data` volume must be mounted (`DATA_DIR=/data`) — ad artwork lives in `/data/ads` and, like photos, is a single copy that database backups do not cover (state the copy-out step in plain words). Selling them: follow "How ads are sold at first" in `docs/decisions/ads-stats-and-services.md` (rate card, founding partners, invoice by bank transfer, monthly report from the campaign's Report block).
2. **Featured listings before Thawani exists:** an owner or agency who wants to be featured is told to email you; you invoice them, and after the bank transfer arrives you use **Feature by hand** in `/admin/payments`.
3. **Thawani (do in this order, same rule as Dukkani's go-live):** (a) email `merchant@thawani.om` for the rate card, settlement schedule, and the question whether a sole-trader registration is accepted (they ask for a commercial registration); (b) register at `merchant.thawani.om`; (c) put the **sandbox** keys on Railway as `THAWANI_API_KEY`, `THAWANI_PUBLISHABLE_KEY` and `THAWANI_ENV=sandbox`; (d) as an owner test account, feature a live listing with Thawani's test card, and check `/admin/payments` shows **Paid** and the listing shows "Featured · مميز" on `/properties`; (e) only then set the **live** keys with `THAWANI_ENV=production`, make **one real 3.000 payment yourself** end to end, and check the money in Thawani's dashboard, before telling anyone cards are on. Until keys are set the site keeps saying "payments aren't switched on yet — contact us". Signed-in admins can confirm the state at `/api/health` (`payments: configured | dormant`).
4. **`AUTH_URL` must be the live https address** (Thawani sends customers back to it).
5. **Prices** are at `/admin/settings/prices`: launch values 3.000 (owners) / 6.000 (agencies) per 30 days; when traffic is proven raise to 6 / 12 and update the ad rate card (60 / 35 / 45 / 30 now; 250 / 120 / 180 / 100 later, per the decision file).
6. **Backups (standards §8):** confirm on the Railway dashboard that database backups are on (the payments records are money records), and include the `Payment` table in the first restore drill.
7. **Legal:** the privacy and terms pages are templates. Now that the site takes money, get them reviewed; replace the personal contact address via `PRIVACY_CONTACT_EMAIL`. Confirm the refund wording (open question 2).
8. `.env.example` and the `docs/CONVENTIONS.md` env-var list gain `THAWANI_API_KEY`, `THAWANI_PUBLISHABLE_KEY`, `THAWANI_ENV` (commented, dormant until set), with the same wording as Dukkani's.

## 11. Standards note (`Agents/docs/engineering-standards.md` §6-8)

- **New personal data: YES, in a small way.** Payment records tie an account to a money transaction (listing, amount, status, gateway reference). Card details are never collected (hosted page). Ad counts are anonymous totals. **The privacy page and terms change in this same build (Build C, section 9.4)**, including removing the now-incomplete "we do not use advertising or tracking cookies" claim. Ad and payment data are not sold or shared beyond the gateway.
- **Touches the core guarantee (provenance labels): YES — tests required** (section 7): featuring and ads must never change a label, a figure, a score or anything the AI analyst sees; an ad must always carry its label.
- **New mutations and external calls: YES.** Checkout start, gateway lookup (Thawani, an external call, dormant until keyed), return confirmation, "check again", hand-feature/un-feature, price edits, ad create/edit/pause/upload, ad view and click counting. Rate limits are named in section 5. All in-memory per process (accepted).
- **CSP:** unchanged, verified against a running server (a script navigation to Thawani, a same-origin ad image, an outbound ad link, no console violations).
- **Backups (§8):** ad artwork on the single-copy `/data` volume; payment records in the database (backups must be confirmed on).
- **GO-LIVE docs stay true to the code in the same change** (Build C, section 10). Update the stale line 34 ("Thawani / PayTabs checkout is deferred (not built)") and the matching README line: featured-listing checkout is now built (dormant until keys); plan-tier checkout is still deferred.

## 12. Done when (a non-developer can check every line)

Ads
- [ ] With no campaigns, the home page, `/market`, a property page and a neighbourhood page look exactly as before: **no empty boxes, no "advertise here"**, and `/market` is still single-column.
- [ ] In `/admin/ads`, create a campaign in each slot with English and Arabic artwork; it appears in the right place on `/en` and `/ar` (Arabic artwork on Arabic pages), always with **"Ad · إعلان"** visible, on a 390 px phone and a 1440 px laptop, with no sideways scroll. A property-page ad appears **only** on properties in its chosen area; a neighbourhood sponsor only on that neighbourhood.
- [ ] Pause the campaign: it disappears at once. A campaign outside its dates is not shown.
- [ ] A second campaign in the same slot (same area) for overlapping dates is refused with a plain message in the admin's language.
- [ ] Clicking an ad goes to the advertiser's site in a new tab; the campaign's click count rises by one; clicking five times in a row within a minute counts once; a link that is not `https://` cannot be saved; a renamed text file and a 3 MB image are refused.
- [ ] Page source of every public page contains **no third-party script** and the site sets **no new cookie**; `curl -I` shows the CSP header unchanged.
- [ ] The campaign report shows views, clicks and click rate by month, with the "approximate" note, in both languages.

Featured listings and checkout
- [ ] `/admin/settings/prices` shows 3.000 / 6.000 / 30 days and the ad rate card; changing 3.000 to 4.500 changes what the next owner checkout shows, and a payment made earlier keeps its old amount. Bad values ("abc", "0", "1.2345") are refused.
- [ ] **With no Thawani keys:** an owner and an agency each open "Feature this listing" for a live listing and see **"Payments aren't switched on yet — contact us to feature your listing."** (Arabic: **«الدفع الإلكتروني غير مفعّل بعد — تواصل معنا لتمييز إعلانك.»**) and a contact email; there is no pay button; nothing is created; `/api/health` (admin) says `payments: dormant`.
- [ ] **Hand-featuring:** in `/admin/payments`, feature a live listing for 30 days for 3.000 OMR by hand with an invoice note. It shows **"Featured · مميز"** at the top of `/properties` in both languages; the payment row appears as "Bank transfer, by hand" and "Paid"; "Stop featuring" removes it.
- [ ] **Cap and order:** with 5 featured listings that match a search, exactly **3** lead the results (rotating hourly), only those 3 carry the "Featured · مميز" label, and the other 2 sit in normal order with no label (as B1 says); an expired featured listing, a withdrawn one and one that is only in review never get a featured slot; filters still apply; nothing appears twice.
- [ ] A featured card still shows its source badge and every figure exactly as before; the listing's status, provenance and price are unchanged after featuring. The property page, compare page and the AI analyst answers are unchanged.
- [ ] Another owner, or an agency that does not own the listing, opening its "Feature" page gets the **same not-found page** as for an address that does not exist.
- [ ] **With Thawani sandbox keys (owner steps 3c-3d):** paying with the test card returns to the result page showing **Paid** and the end date, the listing is featured, `/admin/payments` shows one Paid card payment with a gateway reference and stored gateway answer. Cancelling on Thawani's page returns to a page saying **not completed / pending** and the listing is **not** featured.
- [ ] **Tampering (security checks):** (a) open the return address with a made-up payment id → generic result, no change, an `UNKNOWN_PAYMENT` line appears in the Security log; (b) open the return address for a payment that was never paid on Thawani → still not featured; (c) open the return address of a paid payment again, ten times, and refresh → the end date moves **once**, the Security log shows `ALREADY_CONFIRMED` entries; (d) try to attach the same gateway session to a second payment (test only) → refused by the database; (e) another user's payment id on the result page → not-found page.
- [ ] A double-click on "Pay" does not create two sessions; the payment amount cannot be changed from the browser (the request carries only the listing id).
- [ ] No console CSP violation while going from the checkout button to Thawani's page and back; the CSP header is unchanged.
- [ ] Every new amount on screen has three decimals ("OMR 3.000", "3.000 ر.ع.") and Latin digits on `/ar`; every new string is present in English and Arabic; no `ml-/mr-/pl-/pr-/left-/right-` in new code.

Legal and docs
- [ ] `/en/privacy` and `/ar/privacy` describe direct ads with no ad networks, what is counted, and payment data held by the gateway; the old claim is gone; `/en/terms` and `/ar/terms` have the new "Advertising, featured listings and payments" section; both pages show the build date as "Last updated"; nothing on either page contradicts the owner listing wording from align-4 or the stats line from align-7.
- [ ] `GO-LIVE.md` (steps 1-8 above), `.env.example` and `docs/CONVENTIONS.md` match the code; the old "checkout deferred" lines are corrected.
- [ ] `npm run verify` passes, including every test in section 7, on a clean checkout with a fresh test database; smoke checks pass (`/en` 200, `/ar` has `dir="rtl"`, `/en/market` shows figures, `/en/admin` redirects when signed out, `/api/health` ok); signed out, `curl` of `/en/admin/ads`, `/en/admin/payments`, `/en/admin/settings/prices` and `/en/feature/<id>` returns a redirect whose body contains no data.

## 13. Open questions (defaults apply if you just say "go")

1. **Which hourly-rotating 3 lead when more than 3 listings are featured?** Default: rotate fairly every hour (a fixed formula, so it is testable), rather than "whoever paid last" or "whoever is newest". Say "newest paid first" if you prefer.
2. **Refund wording in the Terms.** Default (already in the text above): no refund when a listing is removed for breaking the terms; if a payment was taken but featuring did not start, we fix it or refund in full; no other refunds. Please confirm or change before this goes live.
3. **Which email do sellers write to while payments are off?** Default: the same contact address as the legal pages (`PRIVACY_CONTACT_EMAIL`, today your personal Hotmail). Say if you want a separate sales address; it is a one-line change.

### Decisions I made that you can overrule (not questions)
- The labels are shown in **both languages on every page** ("Ad · إعلان", "Featured · مميز") rather than only in the reader's language.
- Ad artwork: JPEG/PNG/WebP only, ≤ 2 MB, https links only, one campaign per slot (and area) at a time, no deleting campaigns.
- Views are counted when a page loads, skipping crawlers and counting once per visitor per 10 minutes; they are labelled "approximate" in reports.
- Ad counts are kept per Oman day (not just running totals) so the monthly advertiser report is possible.
- A repeat payment for a listing that is already featured **adds** a further 30 days after the current end date.
- Featuring needs a live listing and is refused for sample records.
- Agency and owner prices are decided by whether the listing has an agency; admin-entered listings can only be featured by hand.

## 14. What I could not check
Mobbin (no access in this session; no prior-art URLs cited). Running the app, the tests, git or the Thawani sandbox — so **which fields Thawani's session lookup returns** (amount, client reference, currency, the full set of `payment_status` values, session expiry) is taken from Dukkani's code (which reads only `payment_status`) and must be confirmed against the sandbox before Build B relies on the amount/reference cross-checks; where a field is absent the spec says to log it rather than fail open. Whether Thawani's documented webhooks carry a verifiable signature (not used here by design). Thawani's fees, settlement schedule, and whether a sole trader can register (owner questions in the decision file). Whether `after()` and the exact `Suspense` streaming behaviour work as described in this Next 16 build (builders read `node_modules/next/dist/docs/`). The final state of align-1, 4, 5 and 7 when this builds (this spec names the files they own and the order to merge; builders must rebase and confirm).
