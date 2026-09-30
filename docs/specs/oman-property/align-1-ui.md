# Align 1 — Screen spec (Sample badge, "worked out from" lines, priced property rows, home notice)

Companion to `align-1-honest-data.md` (sections 2 and 12). All EN/AR wording is fixed there and is not repeated or changed here; this doc only decides looks, placement and states. Rules in force: `docs/CONVENTIONS.md` 1 (honesty) and 4 (logical properties only; `rtl:` only for glyph mirroring and `rtl:text-sm`). Colours, sizes and components below are all ones already used in the app; nothing new is proposed except the one new badge style in section 1.

Mobbin: **the Mobbin tool was not available in this session, so I cite no `mobbin_url`.** I have not invented any. Before the builders start, someone with Mobbin access should pull two or three flows (estimate / "example data" pills; "how this was calculated" hint lines) and add them here. The choices below come from the app's own existing patterns.

## 1. The "Sample data" badge

Purpose: tell the reader at a glance that a figure is invented example data, without looking like a measurement.

- **Look.** Plain grey with a dashed outline. The four real badges are solid pills in green, blue, amber and violet with a solid thin ring. Grey alone would be too close to the plain grey "For sale / For rent" tag on cards, so the **dashed outline** is what makes it its own thing ("placeholder"). No percentage, no icon.
- **Classes** (new entry `SAMPLE_STYLE` next to `provenanceStyles` in `src/lib/provenance.ts`; the badge's shared base classes in `ProvenanceBadge.tsx` stay unchanged: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset rtl:text-sm`):
  `bg-stone-100 text-stone-700 ring-stone-500/30 border border-dashed border-stone-400 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-400/30 dark:border-stone-500`
  Contrast: stone-700 on stone-100 and stone-200 on stone-800 both pass. The badge grows by 2px in height from the border; that is fine.
- **Where the base is dark.** On the home "Honest data" section (`bg-stone-900`) the dark-mode style is what shows, and `border-stone-500` keeps the pill edge visible against stone-900. Builder: check it on that section in both themes.
- **Text.** `provenance.sample` / Arabic equivalent from the spec. Arabic gets the existing `rtl:text-sm` bump (already in the base). The badge is short, so it never wraps at 390px; keep `whitespace-nowrap` on it so it cannot break across two lines beside a long figure.
- **Hint.** Wrapped in the existing `Tooltip` (`src/components/ui/Tooltip.tsx`), label = `provenance.sampleHint`. The bubble shows on hover or keyboard focus only, and the badge span is not focusable, so on a phone a tap shows nothing. For the Sample badge only, add `tabIndex={0}` on the badge span so a tap focuses it and the hint appears (the Tooltip already reveals on focus-within). The bubble is `max-w-56`; the two hints are long (about 5 lines at that width), which is acceptable. Do not add a percentage to the hint.
- **States.** Static label: no pressed or disabled state. Focus: the browser's default focus ring is kept.

## 2. Financial analysis card lines (`FinancialAnalysisCard.tsx`)

Purpose: say how a number was worked out without competing with the number.

- **Hierarchy.** Figure stays `font-semibold text-stone-900 dark:text-stone-100`, label `text-sm text-stone-600`. The explanatory line is the quietest text in the row: `mt-1 text-xs leading-relaxed text-stone-500 rtl:text-sm dark:text-stone-400` (same classes as the card's existing footer note, so it reads as "small print"). No bold, no colour, no italic.
- **Row shape change.** Today a row is one flex line. Make each row a small column: the existing flex line (label left/start, figure + badge at the end) on top, and, only when there is a note, the note below it, full row width, `text-start`, kept inside the row's `border-b` divider. Rows without a note look exactly as today. Reuse the `Row` component; add an optional `note` prop rather than a new component.
- **Placement per row.**
  - Expected market rent: `rentBasisThisProperty`, or `rentBasisAreaAverage` when it is the area fallback.
  - Listed rent (asking): `listedRentFromAnnual` when the rent was yearly.
  - Rental yield: `yieldBasisAsking` / `yieldBasisEstimate` (or `yieldBasisNone` when no yield).
  - Estimated value: when it is only an area-average price, reuse the area-average wording style (same small line); wording for that case is the builder's to flag if the spec has no string (spec 2.2 point 4 mentions the label but gives no key; ask dev-lead, do not invent Arabic).
  - Rows without a special case show no note.
- **Area-average rent is visibly a fallback.** When the expected rent is the area average, its figure is drawn in the muted style `font-semibold text-stone-500 dark:text-stone-400` (not the dark heading colour) so it does not look like a real per-property figure; note beneath as above.
- **"Insufficient data" (yield and score).** Yield row: the existing muted `text-sm text-stone-400 dark:text-stone-500` "Insufficient data" text, with `yieldBasisNone` under it when that applies. Investment score row: the existing `INSUFFICIENT_DATA` band pill (`bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400`), no score number, no badge; the card's existing footer `insufficientDataHint` already explains it. Never show a number or "0".
- **Badges.** Derived figures show the Sample badge (section 1) when any input is sample, else the existing AI-estimated badge. Never green or blue.
- **Phone (390px).** Figure and badge may wrap under the label on a very narrow row: let the flex line use `flex-wrap` so the note is never squeezed beside it. **Laptop.** Card keeps its current width; the notes run wider on one or two lines. No layout change.
- **Loading / error.** Data arrives with the page (server-rendered); no new spinner. Skeleton not needed here.

## 3. Neighbourhood page (`market/[neighborhood]/page.tsx`)

### 3a. Recorded properties rows (priced, clickable)

Purpose: let a visitor see what a recorded home costs and open it.

- **Reuse.** Copy the card patterns from `src/components/marketplace/ListingCard.tsx` (do not import the whole card: it needs a photo and favourites). Reuse: price line `text-lg font-bold text-teal-800 dark:text-teal-300` with the small period `ms-1 text-xs font-medium text-stone-500 dark:text-stone-400` (`enums.rentPeriod.*`), the For sale / For rent tag `rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300` (`properties.sale` / `properties.rent`), and the ProvenanceBadge.
- **Whole card is one link.** Wrap the existing `Card` content in `Link` from `@/i18n/navigation` to `/properties/{id}` (`block`), with hover `hover:border-teal-700` style feedback already used by other linked cards (copy from the browse cards; if none, add `hover:ring-teal-600/40 focus-visible:outline-2`). Do not nest another link or button inside. Pressed: a slight darker ring (`active:ring-teal-600/60`). Tap target: the whole card, well over 44px.
- **Row content, top to bottom.**
  1. Title (existing, `font-medium text-stone-900`), with the "English only" tag as today.
  2. One price line per live listing: price + period on the start side, For sale / For rent tag then that listing's badge on the end side (wraps to a second line at 390px, never overlaps). A property with both a sale and a rent listing shows two price lines, `mt-2` apart.
  3. Existing type / beds / baths / area line (`text-xs text-stone-500`) and the ownership line.
- **No live listing.** Instead of price lines show `market.recordedNoListing` in `text-sm text-stone-500 dark:text-stone-400`; the property's own badge still shows top end; the card is still a link. No tag.
- **Layout.** Phone: one column, cards stacked (`gap-3`). Laptop: existing `sm:grid-cols-2`; consider `lg:grid-cols-3` since rows are now taller and the page is `max-w-6xl`.

### 3b. Area average note

Under the overview cards grid, one line with `market.areaAverageNote`: `mt-3 text-xs text-stone-500 rtl:text-sm dark:text-stone-400` (same as the card footnotes, and `text-start`). Spans the full width on both sizes. Shown only when the overview cards are shown.

### 3c. Compare dropdown option label (`properties/compare/page.tsx`)

Native `<option>` text only (no styling possible). Shape: `{title}, {area} — {price}[ {period}] · {For sale|For rent}`. Price in Latin digits via `formatOMRWhole`; period from `enums.rentPeriod.*` only for rentals. Examples are in spec 2.3. Keep the `·` and `—` as plain text so it is readable in both directions. On a 390px phone the browser truncates or wraps the option itself; put the price and tag at the end so the ends stay visible in a picker sheet is not guaranteed; accept this. The badge under the selected result cards uses section 1 when sample.

## 4. Home page (`HonestData.tsx`, `Hero.tsx`)

### 4a. Sample notice line

- Sits directly under the `h2` (`dataHonestyTitle`) and above the body paragraph, only in sample-only mode. Style it as a quiet callout so it is noticed without shouting: `mt-3 max-w-xl text-sm leading-relaxed text-stone-300 border-s-2 border-stone-500 ps-3 rtl:text-base` (logical border and padding, so it sits on the correct side in Arabic). Not amber or red; the site is not in error, it is being honest.
- Text `home.sampleNotice`. Body paragraph below swaps to `dataHonestyBodySample`. In normal mode this line is not rendered and no space is left behind.
- Phone: full width of the column, wraps to about 3 lines. Laptop: stays in the left column, capped at `max-w-xl` as the paragraph is.

### 4b. Fifth legend row

- Append to the `legend` array (after AI estimated): a row with the Sample badge and `honestyLegendSample`, in the existing `<li className="flex items-start gap-3">` shape (badge on the start side, `text-sm leading-relaxed text-stone-300` text). Shown in both modes.
- Since `ProvenanceBadge` takes `isSample`, the row passes `isSample` and no `provenance`-specific colour. Note the array is typed on `DataProvenance`; a small type tweak is the builder's call.
- The mock example card in `HonestData.tsx` swaps its AI-estimated 62% badge for the Sample badge (section 1). Its `honestyExampleTag` text stays.
- `Hero.tsx`: `heroBadgeSample` uses the same pill styling as `heroBadge` today; no extra colour. Wording is the only change.

## 5. Delight and states

- Empty state "No active listing" is plain, not a joke: it sits next to a real home and a joke there would read as making light of a missing price. Warm tone is already in the fixed strings.
- All new strings go through `messages/*.json` in both languages in the same commit; nothing here adds copy.

## 6. Decisions the owner may want to weigh in on

1. Dashed grey outline for the Sample badge (my pick) versus a solid grey pill with a small "flask" icon; the dashed outline needs no new icon or dependency.
2. Whether the home notice line should have the left/right accent bar (4a) or be plain text.
3. The Estimated-value "area average" note has no fixed string in the spec; that string needs an owner-approved EN/AR line before Build B ships.
