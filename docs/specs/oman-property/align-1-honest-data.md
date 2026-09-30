# Align 1 — Honest data: label sample figures as sample, and make a listing's investment numbers true

App: Oman Property Intelligence. Round: alignment, Oct 2026, Step 1 of `docs/visions/build/oman-property.md` (Agents repo). Written 2026-09-30.

This spec folds in the September spec `Agents/docs/specs/oman-property/honest-listing-numbers.md`. It is split into two builds that two builders can run side by side in separate worktrees, because they touch different files (section 4 lists every file by owner).

- **Build A — Labels.** Every invented figure says "Sample data / بيانات تجريبية", and sample figures step aside once real ones exist.
- **Build B — Honest numbers.** A listing's rent and yield are worked out for that property and say how.

Read `AGENTS.md` (Next.js 16 is not the Next you know: read `node_modules/next/dist/docs/` before touching a Next API) and `docs/CONVENTIONS.md` first. House rules 1, 2, 3, 4, 9 and 11 are all live in this step.

## 0. What I checked, and what I could not

Checked in this worktree (read-only): `prisma/schema.prisma`, `prisma/seed.ts`, `src/components/provenance/ProvenanceBadge.tsx`, `src/lib/provenance.ts`, `src/components/marketing/{HonestData,Hero,TrendsShowcase}.tsx`, `src/lib/db/{market-stats,listings,valuations}.ts`, `src/lib/calculators/*`, `src/lib/trendSummary.ts`, `src/lib/ai/{analyst,analystCore}.ts`, `FinancialAnalysisCard.tsx`, `ListingCard.tsx`, the property, compare and neighbourhood pages, every server action that writes stats, properties or listings, and `messages/en.json` + `ar.json`. Every seeded number below was worked out by hand from `prisma/seed.ts`; the builder must confirm them on a freshly seeded database (section 6).

Could NOT do:
- **Mobbin.** No Mobbin tool was available in this session, so I cite no `mobbin_url`. Nothing here is copied from a comparable app. The closest general pattern is the "estimate" and "example data" pills that property portals and dashboards show (a plain grey label, a one-line hover explanation, no percentage). I picked it from general knowledge, not from a cited flow. `ui-designer` should pull two or three real flows when it runs (section 8).
- **Run anything.** I could not run the app, the tests or the seed. Line numbers and behaviours are from reading the code.
- **The live Railway database.** Never touched. I do not know whether production has already been seeded; section 5 covers both cases.

Backlog rows matched: **none.** `Agents/docs/backlog.md` has two rows for this app (payment provider decision; email notifications) and neither covers this. I did not edit the backlog. Related, already written: `docs/specs/oman-property/align-7-seo-and-stats.md` depends on the `isSample` field name defined here (its sitemap must skip sample listings), so the field name is fixed: `isSample`.

## 1. The problem, in the owner's words

From the owner's decisions (30 Sep 2026): *"Every figure is invented sample data, with some months labelled 'AI-estimated' or 'user-submitted' (untrue). Change — must fix before launch: label all sample data as sample, and hide it once real data exists."*

From the September user test, which this step also fixes: *"Why is Al Mouj 6.5% on the front page and 9.1% on the listing itself?"* Four things behind that sentence:

1. A 110 sqm flat and a 75 sqm flat in the same area are both given the same "expected market rent" (the whole-area average, OMR 650), so the small flat looks like the best investment (9.1% yield, score 82 "Strong") and the bigger one looks worse (6.2%, score 68).
2. A rental villa shows its real asking rent (OMR 2,140) one line above an estimate (OMR 1,808), and the yield (4.5%) silently uses the estimate.
3. The compare-listings dropdown prints "OMR 2,140" for a monthly rent in the same shape as a sale price like "OMR 125,500".
4. The neighbourhood page's "Recorded properties" show no price and cannot be clicked.

Today's real state of the data (verified in `prisma/seed.ts`): 11 neighbourhoods x up to 2 property types x 24 months of market figures, 16 properties, 22 listings and 6 valuations, all invented. The seed comment says they are "labeled USER_SUBMITTED / AI_ESTIMATED with 'sample data' source notes", so the site shows "AI estimated 35%" or "User submitted 40%" on figures nobody estimated or submitted. That is untrue, and house rule 1 ("data honesty is the product") is broken by our own seed.

## 2. What the user will see and do, screen by screen

### 2.1 Build A — everywhere a figure carries a badge

- The badge on any sample figure reads **"Sample data"** (English) / **"بيانات تجريبية"** (Arabic). It has its own plain grey look, clearly different from the four existing badge colours, and **shows no confidence percentage** (a percentage on invented data suggests it was measured). Hovering (or tapping, on a phone) shows this hint:
  - EN: "Example figures that show how the site works. Do not rely on them for decisions. They are replaced as soon as real figures exist for the same area."
  - AR: "أرقام توضيحية تُظهر طريقة عمل الموقع. لا تعتمد عليها في قراراتك. تُستبدل بمجرد توفر أرقام حقيقية للمنطقة نفسها."
- This applies on: the market dashboard `/market`, the neighbourhood page, the neighbourhood comparison, the home page trend cards and the example card, browse cards, the property page (listing rows and the details card), the compare-listings page, the AI analyst's "data used" list, and the admin lists. Admin lists still show sample rows (the admin must be able to see and delete them), just marked.
- A figure worked out from a sample figure is also sample. If any input is sample, the derived figure's badge says "Sample data". A derived figure is never "Verified" or "Official statistic" (house rule 1, unchanged).
- Real rows keep exactly today's badges (Verified, Official statistic, User submitted, AI estimated), unchanged.

**Sample figures step aside once real ones exist.** The rule, stated once, used everywhere (pure function, section 5):

- A sample market figure is hidden when a real (non-sample) figure exists for the **same place, same property type and same month**. When an admin enters a real Al Mouj apartment figure for June 2026 in `/admin/market-stats`, that record **replaces** the sample row in place (the admin form already updates the existing row for that place+type+month; it must now also mark it real). Al Mouj villas and other months stay sample until they get real figures.
- A sample listing or property is hidden from public lists, search, dropdowns and maps once a real, live (ACTIVE) listing exists in the **same neighbourhood and property type**. A sample valuation is hidden once the same property has a real valuation.
- A direct link to a hidden sample property still opens (so saved links and favourites do not break); its badges say "Sample data".
- Admin screens are never filtered.

**Home page.** While the whole site holds only sample data (no real market figure exists anywhere), the promise is softened. Exact wording:

| Where (key in `messages/*.json`, `home` block) | English | Arabic |
|---|---|---|
| `heroBadgeSample` (replaces `heroBadge` while sample-only) | "Sample figures while we load real data" | "أرقام تجريبية إلى حين تحميل البيانات الحقيقية" |
| `featureCompareBodySample` (replaces `featureCompareBody`) | "Al Mouj vs Qurum vs Muscat Hills — side by side (sample figures for now)." | "الموج مقابل القرم مقابل تلال مسقط — جنبًا إلى جنب (بأرقام تجريبية حاليًا)." |
| `dataHonestyBodySample` (replaces `dataHonestyBody`) | "Every number on this platform carries a label saying where it came from: verified, official statistic, user-submitted, AI-estimated or sample, with a confidence score where one applies. Right now the figures are sample data, and we say so on every one." | "كل رقم في هذه المنصة يحمل تصنيفًا يوضح مصدره: موثّق، إحصاء رسمي، مُدخل من المستخدمين، تقدير ذكاء اصطناعي أو بيانات تجريبية، مع درجة ثقة حيثما انطبق ذلك. حاليًا الأرقام بيانات تجريبية، ونذكر ذلك على كل رقم." |
| `sampleNotice` (one line under the "Honest data" heading, sample-only) | "For now, every figure on this site is sample data. We are loading official statistics, and sample figures disappear as real ones arrive." | "حاليًا، كل الأرقام في هذا الموقع بيانات تجريبية. نعمل على تحميل الإحصاءات الرسمية، وتختفي الأرقام التجريبية كلما وصلت أرقام حقيقية." |

- The "Why we are different" legend gains a fifth entry, always shown (both modes), with the Sample badge:
  - `honestyLegendSample` EN: "Example figures that show how the site works. Replaced as soon as real ones exist for the same area." AR: "أرقام توضيحية تُظهر طريقة عمل الموقع. تُستبدل بمجرد توفر أرقام حقيقية للمنطقة نفسها."
- The illustrative example card ("Example card — the figures below are illustrative") switches from an "AI estimated 62%" badge to the Sample badge (it is invented by definition).
- Once any real market figure exists anywhere, the normal wording returns (`heroBadge`, `featureCompareBody`, `dataHonestyBody`; the notice line disappears). "Sample-only" is decided from the data, not a switch, and is cached with `MARKET_DATA_CACHE_TAG` like everything else on the public market pages.
- The phrase "on real data" in today's `featureCompareBody` is the untrue promise this replaces.

### 2.2 Build B — the property page's "Financial analysis" card (`/properties/[id]`)

Rows keep their order and their badges: Estimated market value, Price per sqm, Listed rent (asking), Expected market rent, Gross rental yield, Investment score. Four changes:

1. **Expected market rent is worked out for this property.** It is the property's own floor area x the area's rent per square metre. Under it, one small plain line says how, in the reader's language (strings in 2.4). It keeps the AI-estimated character, capped at the existing derived-confidence ceiling (0.5). It is worked out like this, from figures the app already stores for that area, property type and latest month: *rent per sqm = average monthly rent x average price per sqm / average sale price* (this is the average rent divided by the average unit size implied by the stats). No new data entry.
   - Al Mouj apartments (seed, June 2026): OMR 650 rent, OMR 120,000 sale price, OMR 1,142.857 per sqm, so rent per sqm is about OMR 6.190. The **75 sqm** 1BR shows about **OMR 464 a month**. The **110 sqm** 2BR shows about **OMR 681 a month**. (Today both show OMR 650.)
2. **Yield uses the real asking rent when the property has one.** If the property has a live rent listing, yield = asking rent x 12 / estimated value, and one line says so. The estimate stays on the page, labelled as the estimate, as the second line. A yearly asking rent (`rentPeriod` ANNUAL) is converted to per month first (today the code ignores the period), with a line "Advertised as {annual} a year; shown per month."
   - Al Mouj 4BR golf-course villa, asking OMR 2,140 a month, estimated value about OMR 477,008 (OMR 1,255.285 per sqm x 380 sqm): yield **5.4%** (today 4.5%), line says "Yield worked out from the advertised rent of OMR 2,140 a month." Its expected rent line shows about **OMR 2,147**, next to the asking 2,140.
   - With no asking rent, the yield uses the per-property estimate and says so.
3. **Both Al Mouj flats will now show the same yield (about 6.5%) and about the same score.** This is correct and expected: with only an area average to go on, rent per sqm and price per sqm scale together, so a bigger flat earns proportionally more rent. What goes away is the false story that the smallest flat is the best buy. Owner and tester must not read "same yield" as a bug. (The score also depends on the confidence and age of the data, both the same for these two.)
4. **When we genuinely cannot work it out, we say so.** Cases: no floor area recorded, or the area's stats lack the numbers for the sum (a real official row may carry only some of the fields). Then "Expected market rent" shows the area average, plainly labelled "Area average — not this property's own rent. Left out of the yield and the score." and the **yield and investment score show "Insufficient data" / "بيانات غير كافية"**, with the existing `insufficientDataHint`. The same holds when the "estimated value" is only an area-average price because the property has no floor area and no stored valuation (today the code silently falls back to the area average price): that value is labelled area average and is not used for yield. No score is better than a flattering wrong one.

The badges on these derived figures follow 2.1: "Sample data" if any input is sample, else "AI estimated" with the confidence (capped at 0.5). Never Verified or Official.

### 2.3 Build B — compare listings (`/properties/compare`) and the neighbourhood page (`/market/[neighborhood]`)

**Compare dropdown.** Each option reads title, price and, for rentals, the period, then a for-sale / for-rent tag, using the same words the browse cards already use (`enums.rentPeriod.*` and `properties.sale` / `properties.rent`; no new strings):
- EN: "4BR golf-course villa, Al Mouj — OMR 2,140 per month · For rent" and "2BR marina-view apartment, Al Mouj — OMR 125,500 · For sale".
- AR: "فيلا 4 غرف على ملعب الجولف، الموج — OMR 2,140 شهريًا · للإيجار" and "… — OMR 125,500 · للبيع". (The build plan writes this as "/ month"; I chose the browse cards' existing "per month" wording so the two screens never phrase it two ways. If the owner prefers the short "/ month", `common.perMonth` already exists in both languages.)
- The result cards under the dropdown read the same corrected numbers as the property page (one calculation, one answer) and show the same "worked out from" lines.
- The dropdown's list of listings applies the sample-hiding rule (it queries the database in the page today; see file ownership).

**Neighbourhood page.**
- Overview cards keep the stored area figures, including the 6.5% gross yield. Under the cards, one line says what they are: EN "These are averages for the whole neighbourhood, from the recorded market figures. They are not the rent or yield of any one property." AR "هذه متوسطات للحي كله من أرقام السوق المسجّلة، وليست إيجار أو عائد أي عقار بعينه." Key: `market.areaAverageNote`. The stored figure is not changed.
- **Recorded properties** rows become links to `/properties/{id}` (the whole card is one link; use `Link` from `src/i18n/navigation.ts`, house rule 5). Each row shows, for every live listing the property has, the price (with "per month" for rentals), the "For sale / For rent" tag and that listing's badge, matching the browse cards. A property with no live listing shows "No active listing" (key `market.recordedNoListing`; EN "No active listing", AR "لا يوجد إعلان نشط") and still links to its page. Prices come from the existing `searchListings({ neighborhoodSlug })` query, which is sample-aware after Build A; do not add a second listing query.

### 2.4 Exact new strings, Build B (`messages/en.json` and `ar.json`, `properties` block unless noted)

Amounts are passed in already formatted with `formatOMR` / `formatOMRWhole` (Latin digits, three decimals for per-sqm, whole OMR for rents). `{area}` is the floor area with the existing `common.sqm` unit ("75 sqm" / "75 م²").

| Key | English | Arabic |
|---|---|---|
| `rentBasisThisProperty` | "Worked out from this property's {area} at the area's rent per square metre ({rentPerSqm})." | "محسوب من مساحة هذا العقار ({area}) بمتوسط إيجار المتر المربع في المنطقة ({rentPerSqm})." |
| `rentBasisAreaAverage` | "Area average, not this property's own rent. Left out of the yield and the score." | "متوسط المنطقة، وليس إيجار هذا العقار نفسه. لا يدخل في حساب العائد أو المؤشر." |
| `yieldBasisAsking` | "Yield worked out from the advertised rent of {rent} a month." | "العائد محسوب من الإيجار المعلن البالغ {rent} شهريًا." |
| `yieldBasisEstimate` | "Yield worked out from the estimated market rent of {rent} a month (this property has no advertised rent)." | "العائد محسوب من الإيجار السوقي المقدّر البالغ {rent} شهريًا (لا يوجد إيجار معلن لهذا العقار)." |
| `yieldBasisNone` | "No yield shown: without this property's size or an advertised rent, we cannot work out a rent for it honestly." | "لا يظهر عائد: دون مساحة هذا العقار أو إيجار معلن لا يمكننا تقدير إيجاره بصدق." |
| `listedRentFromAnnual` | "Advertised as {annual} a year; shown per month." | "معلن بـ {annual} سنويًا؛ يظهر هنا شهريًا." |
| `market.areaAverageNote` | see 2.3 | see 2.3 |
| `market.recordedNoListing` | see 2.3 | see 2.3 |

Build A's strings (`provenance` and `home` blocks): `provenance.sample` = "Sample data" / "بيانات تجريبية"; `provenance.sampleHint`, `home.heroBadgeSample`, `home.featureCompareBodySample`, `home.dataHonestyBodySample`, `home.sampleNotice`, `home.honestyLegendSample` exactly as in 2.1.

## 3. Explicitly OUT of scope

- Loading real data (CSV upload, agency upload, automatic averages from listings). That is Step 3. This step only makes the site tell the truth about what it has and get out of the way when real data arrives.
- Any new source badge type or database enum value (Step 3 adds `LISTING_DERIVED`). Sample-ness is a separate flag, not a fifth provenance value, so the old code keeps working on the new schema.
- Deleting sample rows. They are hidden, never removed (build plan: additive database changes only).
- A number showing the margin of error on stats, listing "still available" checks, listing expiry.
- The three calculators, and their input-limit and ROI bugs (separate work).
- Photos, agency forms, header tap targets, Arabic plural agreement on room counts (September ranks 2 and 3). If a new line in this spec prints a count of rooms or years, get the Arabic plural right in that line.
- Changing the stored neighbourhood yield (explained only, not rewritten, per the September default).
- A chart note saying "some months are sample" where a chart mixes real and sample months (see open question 1).
- An admin-form checkbox for "this row is sample". Rows made through the app are never sample; only the seed makes sample rows.

## 4. Who owns which file (so the two builds do not collide)

Each builder works in their own worktree with their own test database. Merge order: **A first, then B rebases.** Only Build A creates a migration. Both builds add message keys, but each only in its own blocks (A: `provenance`, `home`; B: `properties`, `market`) and never edits an existing key.

**Build A owns (labels):**
- `prisma/schema.prisma`, the new `prisma/migrations/<timestamp>_add_is_sample/` folder, `prisma/seed.ts`
- New `src/lib/db/sampleData.ts` (+ `sampleData.test.ts`), `src/lib/db/market-stats.ts`, `src/lib/db/listings.ts` (includes `nearestMarketStat`, `searchListings`, `activeListingsForProperty`, `agencyContactForProperty`, `listingsForCompare`)
- `src/lib/provenance.ts`, `src/components/provenance/ProvenanceBadge.tsx`
- `src/lib/trendSummary.ts` + `trendSummary.test.ts` (a trend built from any sample point is Sample)
- `src/components/marketing/{HonestData,Hero,TrendsShowcase}.tsx`
- `src/lib/ai/analyst.ts`, `src/lib/ai/analystCore.ts`, `src/components/marketplace/AiAnalystCard.tsx`, `src/lib/ai/analystCore.test.ts` (extend, never weaken)
- Every other place that draws a `ProvenanceBadge` or reads stats/listings: `src/app/[locale]/(public)/market/page.tsx`, `.../market/compare/page.tsx`, `.../properties/[id]/page.tsx`, `src/components/marketplace/ListingCard.tsx`, the admin pages (`review`, `listings`, `market-stats`, `properties`)
- Cache refresh on writes: `src/app/[locale]/(admin)/admin/{market-stats,review,listings,properties}/actions.ts` and `src/app/[locale]/(agency)/agency/actions.ts`
- `docs/CONVENTIONS.md`: rule 1 gains one sentence about `isSample`; the seed-comment paragraph is updated.
- `messages/*.json`: `provenance` and `home` blocks only.

**Build B owns (honest numbers):**
- New `src/lib/calculators/` file(s) for the pure functions (suggested `rentEstimate.ts`), and `src/lib/calculators/calculators.test.ts` (extend)
- `src/lib/db/valuations.ts` (`propertyFinancials`, the `Figure` and `PropertyFinancials` types)
- `src/components/marketplace/FinancialAnalysisCard.tsx`
- `src/app/[locale]/(public)/properties/compare/page.tsx` (dropdown labels and its own badge)
- `src/app/[locale]/(public)/market/[neighborhood]/page.tsx` (average-note line, priced links, and both of its badges)
- `messages/*.json`: `properties` and `market` blocks only (new keys only).

**Agreed contract between the two builds (Build A's first commit, a "checkpoint", so B can rebase early):**
1. The four new columns exist and are named exactly `isSample` (`Boolean @default(false)`) on `MarketStat`, `Property`, `Listing`, `ValuationEstimate`.
2. `ProvenanceBadge` accepts an optional `isSample` prop (true = draws the Sample badge, ignores confidence). Existing callers work unchanged. B passes `isSample` in the files it owns.
3. `sampleData.ts` exports the one rule as pure function(s) over rows (drop superseded sample market figures; prefer a real valuation over a sample one; decide the sample-only home mode) so B's `valuations.ts` and A's queries call the same code. The names are the builders' choice; they must agree them in that first commit.
4. `nearestMarketStat`, `searchListings` and `activeListingsForProperty` already apply the rule and return `isSample` on each row.
5. B's side of the contract: `Figure` gains `isSample: boolean` in B's first commit.

**Until B lands, B can start with the pure functions and their tests (no dependency on A).** B's `valuations.ts` change waits for A's checkpoint.

**Join step (after both merge; a short pass by dev-lead, not a third parallel builder):** `analyst.ts` tags `FIN-YIELD` and `FIN-SCORE` as sample when `financials.grossYieldPct.isSample` is true, and its prompt text for the yield says whether it came from the asking rent or the estimate; run the full verify recipe once more.

## 5. Build A in detail

1. **Schema and migration (house rule 11).** Edit `schema.prisma`, run `npx prisma migrate dev --name add_is_sample`, commit the folder. Never `db push`. Additive only: four new columns with default false, nothing dropped or renamed. The same migration file also **marks the rows already in a database as sample**, with plain `UPDATE` statements matching the exact text the seed writes: `MarketStat` where `sourceNote = 'Sample data for demonstration — replace with real figures.'`; `Property` where `sourceNote = 'Sample record for demonstration.'`; `ValuationEstimate` where `assumptions` starts `'Sample AI-estimated valuation for demonstration'`; `Listing` where its property is now sample (a listing on an invented home is invented; `Listing` has no source-note field). Without this, any database seeded before the migration (the owner's dev copy, possibly Railway) would show invented figures as real, because the seed skips rows that already exist.
2. **Seed.** New rows are created with `isSample: true`. Re-running the seed must also flag any existing matching rows (so a database seeded by an older version is repaired). The seed keeps provenance and confidence values as they are (untouched enum, nothing dropped); the comment at the top of the file is rewritten to say the rows are sample. It must never mark a row sample that an admin has since edited (matching on the exact note text handles this: editing changes the note or the flag).
3. **App writes are never sample.** `upsertMarketStat` (house rule 6: the only path for stat writes) must, when it finds an existing row for that place+type+month, **set `isSample` to false** and **clear every metric the caller did not supply**, so a real row never keeps an invented sample size or median. Pull that data-building step into a small pure function so it can be unit tested without a database.
4. **Queries.** Apply the rule in `market-stats.ts` (`latestStatsByNeighborhood`, `latestNeighborhoodStat`, `neighborhoodTrends`, `neighborhoodBySlug`'s properties), `listings.ts`, and the analyst's own direct queries in `analyst.ts` (valuation, history, comparables). Return `isSample` in every selected shape (the trend query uses an explicit `select`; add the field). Note `latest*` queries take the latest row *after* hiding.
5. **Cache (Risks in the build plan).** The public market pages are cached under `MARKET_DATA_CACHE_TAG` (5 minutes). `saveMarketStat`, `deleteMarketStat`, the review approvals and the admin property writes already call `updateTag(MARKET_DATA_CACHE_TAG)`. I found **no** refresh in `admin/listings/actions.ts` (create, edit, `setStatus`), in the listing approve/reject in `admin/review/actions.ts` (around lines 40 to 52), or in `agency/actions.ts` (submitting a listing). Because a real live listing now hides sample properties on the cached neighbourhood page, every one of those write paths must refresh the tag too. The builder should search for any other write to `MarketStat`, `Property` or `Listing` and cover it. Add a test or a written check-list in the PR so this cannot silently regress. (Step 3's job route will not be able to call `updateTag`; leave a comment where that seam will be.)
6. **Badge and copy.** Sample style in `provenance.ts`, prop in `ProvenanceBadge`, hover hint via the existing `Tooltip`. All strings from 2.1 in both languages in the same commit (house rule 3). Layout with logical properties only (house rule 4); the Arabic badge text gets the existing `rtl:text-sm` bump.
7. **AI analyst.** Offered figures that come from sample rows say "SAMPLE DATA" in the prompt text and carry `isSample` into the saved citation snapshot, and `AiAnalystCard` shows the Sample badge on them. `analystCore.test.ts` must still pass, and gets one new case: a sample figure cited in an answer is labelled sample and its confidence still caps the answer.
8. **Docs.** `docs/CONVENTIONS.md` rule 1 gains: "Sample rows carry `isSample`; the badge says 'Sample data' and public queries hide a sample row once a real row exists for the same place, type and month."

## 6. Build B in detail

Pure functions in `src/lib/calculators/` (house rule 9: no financial maths in the UI or in `valuations.ts` beyond calling them):
- area rent per square metre from the three stored averages (null if any is missing or not above zero);
- a property's expected rent = its floor area x that (null if no floor area);
- normalise a listed rent to per month (annual / 12);
- choose the rent for the yield: asking rent if there is one, else the per-property estimate, else none, and say which (`ASKING` / `ESTIMATE` / `NONE`);
- the confidence cap and the "any input sample means sample" rule for derived figures.

`propertyFinancials` then calls them and returns, alongside each `Figure`, the small facts the card needs to print its line (the basis, the floor area used, the rent per sqm, the rent used). It returns **facts, not English sentences**, so the card can say them in either language.

Tests (in `calculators.test.ts`, run by `npm test`):
- rent scales with floor area (75 sqm < 110 sqm, same area);
- an asking rent beats the estimate for the yield; annual asking rent is divided by 12;
- no floor area, or missing area figures, gives no rent, no yield and no score, never a wrong one;
- a derived figure is never `VERIFIED` or `OFFICIAL_STAT`, and its confidence never exceeds 0.5;
- sample inputs give a sample output;
- the seeded scenarios: Al Mouj 75 sqm and 110 sqm expected rents differ (about 464 and 681); villa yield with asking rent 2,140 and value about 477,008 is about 5.4%;
- one regression test that the property page and the compare cards get the same numbers (both call `propertyFinancials`, so assert on that single function).

Also: `analystCore.test.ts` must still pass unchanged, and the build report must say so, since `analyst.ts` reuses `propertyFinancials`.

## 7. The data touched, in plain terms

- Four record types (market figures, properties, listings, valuations) each get one yes/no mark: "is this sample data". Existing rows already in a database are marked automatically (section 5.1) so nothing invented ever looks real.
- Nothing about a person is collected or stored. No new form, no new visitor input.
- Every figure keeps its source label and confidence in the database as before; the mark only changes what the badge says and whether the row is shown.
- Money stays `Decimal(12,3)`; every displayed amount goes through `formatOMR` / `formatOMRWhole` (Latin digits in Arabic). Decimals become strings before crossing to a client component.
- A schema change means the owner should confirm a Railway database backup before shipping (build plan section 7 already asks for this).

## 8. Bilingual note

Every new string is in section 2 in both languages and lands in `messages/en.json` and `messages/ar.json` in the same commit as the code (house rule 3). Arabic specifics: money stays in Latin digits with the same currency formatting as today; the Sample badge and the "worked out from" lines sit in the normal text flow (right-to-left through the page's `dir`, logical spacing only, no `ml-/mr-/left-/right-`); charts and maps stay `dir="ltr"`. The Arabic word for sample is "تجريبية" (matching the owner's wording "بيانات تجريبية"); "sample" is not translated as "example" or "illustrative" anywhere else in the Arabic UI, to avoid a second word for the same thing. The existing home example card tag ("بطاقة توضيحية") is a different concept (a mock card) and stays.

## 9. Done when (a non-developer can check every line)

Set up: `npx prisma migrate deploy`, `npm run db:seed` on a fresh local copy, then `npm run dev`. Also check once on a database seeded **before** this change.

**Labels (Build A)**
- [ ] On `/en/market` and `/ar/market`, every seeded figure shows "Sample data" / "بيانات تجريبية". No card shows "AI estimated" or "User submitted" on seeded data.
- [ ] The same on the neighbourhood page, compare-neighbourhoods, home trend cards, browse cards, a property page (listing rows and the details card) and the AI analyst's "data used" list. Hovering the badge shows the hint in the page's language.
- [ ] The sample badge shows no percentage.
- [ ] In `/admin/market-stats`, enter one real official Al Mouj apartment figure for June 2026 (provenance Official statistic, with a source link). Open `/en/market/al-mouj` and `/ar/market/al-mouj`: the June 2026 apartment card now shows the real figure with the blue "Official statistic" badge, and no sample row for Al Mouj apartments in June 2026 is visible anywhere public. Al Mouj villas and other months still show "Sample data". Within a minute of saving (not five), the public market pages show the change.
- [ ] Open the admin list: the sample rows are still there for the admin, still marked sample.
- [ ] Add a real live listing in Al Mouj for an apartment (approve it in the admin). The sample Al Mouj apartment listings vanish from `/properties` and the compare dropdown; a saved direct link to one of them still opens and says "Sample data".
- [ ] Home page, before any real figure exists: the softened hero badge, compare-card text, "Honest data" paragraph and the notice line, in both languages, matching the strings in 2.1. After the real figure above is saved, the normal wording returns.
- [ ] Re-running `npm run db:seed` twice changes nothing and does not turn the real Al Mouj row back into sample.
- [ ] A database that was seeded before this migration shows the same "Sample data" labels after `migrate deploy`, without re-seeding.

**Honest numbers (Build B)**
- [ ] The Al Mouj **110 sqm** 2BR (OMR 125,500) and **75 sqm** 1BR (OMR 85,500) show **different** expected rents (about OMR 681 and about OMR 464), each with a line saying it was worked out from that property's own size. Both now show about the same yield (about 6.5%), which is expected (section 2.2, point 3), not the old 9.1% versus 6.2%.
- [ ] The Al Mouj 4BR golf-course villa (asking OMR 2,140 a month) shows a yield of about **5.4%** and the line "Yield worked out from the advertised rent of OMR 2,140 a month." The estimate (about OMR 2,147) is still shown as the estimate. Arabic shows the Arabic line with money in Latin digits.
- [ ] A property with no floor area shows "Insufficient data" / "بيانات غير كافية" for yield and investment score, and its rent is labelled as an area average.
- [ ] Compare listings: the villa option reads "… — OMR 2,140 per month · For rent" and a flat reads "… — OMR 125,500 · For sale", in English and Arabic (per section 2.3).
- [ ] Neighbourhood page, "Recorded properties": each row is clickable, shows its price(s) with the For sale / For rent tag and a badge, and opens the property page. A property with no live listing says "No active listing".
- [ ] The Al Mouj neighbourhood page and a listing page each say in one line what their own figure is (whole-area average versus this property).
- [ ] No figure the app worked out itself is labelled verified or official.

**Everything**
- [ ] `npm run verify` passes (lint, typecheck, build, tests), including the new tests, `analystCore.test.ts` and `trendSummary.test.ts`; smoke checks pass (`/en` 200, `/ar` contains `dir="rtl"`, `/en/market` shows figures, `/api/health` ok).
- [ ] `grep` finds no new `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` in the changed files.

## 10. Open questions (each with my suggested default)

1. **How much sample data hides when one real figure arrives?** The build plan and your check ("the sample rows for that area+month disappear") mean the narrow rule: only the same place + type + month. Consequence: enter one real month and the 23 other months of that area's history stay sample, so a trend chart can show one real point among sample points, and the "latest" figure stays sample if the real month is older than the newest sample month. Every card still has its own honest badge; charts have no per-point badge. The broad alternative: hide all sample history for that area and type once any real month exists (honest, but charts go nearly empty until history is uploaded). **Default: the narrow rule now**, since Step 3's bulk upload will replace whole histories at once and make the difference small. A "chart includes sample months" note can be added then if you want it.
2. **Where does "the area's rent per square metre" come from?** **Default: work it out from the three averages already stored** (rent x price per sqm / sale price), so no new data entry and no schema change beyond `isSample`. If an official row lacks one of those, the property falls back to the honest "insufficient data" path. The alternative is a new optional "rent per sqm" box on the admin market-figures form (more accurate, blank until someone types it, needs another migration).
3. **Do sample listings and properties disappear when a real listing appears in the same area and type?** **Default: yes**, from public lists, search, the compare dropdown and maps (a direct link still opens, badge says Sample). Alternative: sample listings stay until you delete them by hand, which keeps the browse page fuller at launch but shows invented homes next to real ones.

Carried over from September, decided by default (say so if you disagree): the neighbourhood's own 6.5% is only explained, not changed; when a rental has an asking rent, the estimate stays visible as a second line.

## 11. Standards note (`Agents/docs/engineering-standards.md` sections 6, 7, 8)

- **New personal data? No.** Nothing about a person is collected or stored. Section 6's "privacy page changes in the same change" does not apply; `src/app/[locale]/(public)/privacy/page.tsx` needs no edit.
- **Touches the core guarantee? Yes, squarely.** Standards section 7 names Oman Property's guarantee as provenance labels and the AI leash. **This spec requires tests, in the same change:** the sample-hiding rule (`sampleData.test.ts`: a sample row is dropped only for the same place+type+month as a real one; direct rows for other months or types stay; a real valuation beats a sample one; sample-only mode on and off); the stat-write data builder (an app write sets `isSample` false and clears unsupplied metrics); `trendSummary` (a trend with any sample point is Sample); the rent and yield functions (section 6); and an extended `analystCore.test.ts`. All run inside `npm test`, so `verifier` runs them on every job. A diff in this area with no test is a code-review finding.
- **Mutations or external calls? No new ones.** No new server action, form, external or paid call. The existing stat and listing writes only gain the `isSample=false` behaviour and cache refreshes, and keep their existing limiter (admin actions per minute per user; per-process in-memory `src/lib/rate-limit.ts`, `REDIS_URL` not wired). Nothing new to rate-limit.
- **Backups (section 8).** A migration is added. It is committed and applied by `npx prisma migrate deploy`; the data-marking `UPDATE`s are safe to re-run. Confirm a Railway backup before the owner ships (standing item). No new uploaded files.

## 12. Screens: run `ui-designer` first

Yes, briefly, before Build A and B start (or at least before they reach the UI):
- the Sample badge (grey, distinct from the four others, works in dark mode and in Arabic, readable at 390 px);
- the "worked out from" and "yield used" lines under figures on the financial card (they must not out-shout the number they explain; `Agents/docs/design-standards.md` applies, overridden by the repo's own conventions);
- the priced "Recorded properties" rows and the compare dropdown label shapes;
- the home page sample notice and fifth legend row.

`ui-designer` should look up two or three real Mobbin flows of comparable apps doing this (labelling estimates or example data; showing how an estimate was worked out) and cite them by `mobbin_url`; I could not.
