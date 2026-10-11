# Align Step 3 — Screen design (UI spec)

App: Oman Property Intelligence. Round: October 2026 alignment, Step 3 "Real data machinery".
Written 30 Sep 2026 by ui-designer. Reads with `docs/specs/oman-property/align-3-real-data.md` (the approved behaviour spec — every string key quoted here is from its string tables unless marked NEW) and `docs/CONVENTIONS.md`.

No code. Nothing here needs a new dependency.

## 0. Sources, and what I could not do

- Read: `docs/CONVENTIONS.md`, the approved behaviour spec, `Agents/docs/design-standards.md`, and the existing screens `/admin/market-stats` (page + form), `/admin/review`, the agency dashboard and its loading screen, the public `/market` and `/market/[neighborhood]` pages, and the shared pieces `ProvenanceBadge`, `provenance.ts`, `Button`, `Card`, `Field`, `Tooltip`, `Skeleton`.
- The app's design system is its existing look: stone neutrals, teal primary, Tailwind classes, one font, `rounded-xl` cards with a thin ring, 44px minimum touch targets, dark mode built in. `docs/design/` only holds the iOS spec (same look, written down); there is no token file. Everything below uses classes and components already on those screens. Anything new is marked **PROPOSED**.
- **Mobbin: I was not given a Mobbin tool in this session, so I have NOT cited any `mobbin_url`. I will not invent them.** Section 9 gives exact search briefs so whoever has the tool can pull the flows in a few minutes and paste the URLs in. The spec does not depend on them; they are for taste-checking.

## 1. Shared rules for every screen below

Layout and direction
- Page frame matches the other admin pages: `mx-auto max-w-6xl px-4 py-10`. Sections 32px apart, things that belong together 8 to 12px apart. All spacing multiples of 4.
- Phone = 390px wide, one column, everything stacks. Laptop = 1440px: content stays in the centred 1152px frame (never stretches edge to edge), and the extra width is used for a two-column layout where noted.
- Logical spacing only (`ms-/me-/ps-/pe-/text-start/text-end/border-s-`). The only `rtl:` uses are the existing ones: `rtl:text-sm` to lift small Arabic text, and `rtl:rotate-180` on arrow glyphs.
- In Arabic: the page, the headings, the table column order and every sentence read right-to-left. The first table column sits at the right edge. Things that are code-like stay left-to-right inside their own little box, using the existing `dir="ltr"` inline wrapper: column names (`source_url`), values found in the file, source web addresses, CSV file names. Numbers are always Latin digits (0-9) in both languages, including line numbers and counts. Money: `formatOMR` (3 decimals, e.g. `145,000.000`) in the preview table, `formatOMRWhole` on public cards (as today). Percentages with `formatPercent`. Months with `formatMonth`.
- Accented figures sit at the reading-end of their row: right in English, left in Arabic (the tables do this with `text-end`).

Colour meaning (no new colours except the one badge)
- Green (emerald) = done/succeeded. Red (rose) = problem, blocks the action. Amber = warning, allowed but worth knowing ("replaces an existing figure", "not approved yet", "rate limited"). Stone/grey = neutral info. Teal = primary button and the new "From live listings" badge.
- Result boxes copy the existing ones exactly: `rounded-lg px-4 py-2 text-sm ring-1 ring-inset` in emerald-50 / rose-50 / amber-50 (dark: emerald-950 / rose-950 / amber-950).

Buttons (existing `Button`, 44px tall)
- Default / hover (darker fill, desktop) / pressed (same as hover on touch plus the focus ring on keyboard) / disabled (50% opacity, no pointer) / loading (label swaps to the "...ing" text and the button is disabled; no spinner needed, matches the existing forms).
- One filled (primary) button per view. "Check file" is primary until a preview exists; then "Import" becomes the one primary and "Choose a different file" is ghost.

Inputs: focus = teal ring (existing `Input`), error = rose ring + plain message under the field (existing `FieldError`). File-level refusals (too big, wrong type) show as the rose result box above the file picker AND mark the picker with the error ring.

Waiting on data: every region that waits gets grey shapes from the existing `Skeleton` (light `stone-200`, dark `stone-800`, gentle pulse, still for reduced motion). Shapes must match the real content (described per screen).

The badge for each figure: `ProvenanceBadge` on every row that shows a figure, everywhere (rule 1).

## 2. Changes to the shared badge: "From live listings"

Purpose: show that a figure is an average of this site's own asking prices, never an official number, and how many listings it rests on.

Look (**PROPOSED: one new badge colour, teal**, as already decided in the behaviour spec, Build C)
- Same pill as the other four (`rounded-full px-2 py-0.5 text-xs`, `rtl:text-sm`, ring). Light: `bg-teal-100 text-teal-800 ring-teal-600/20`. Dark: `bg-teal-950 text-teal-200 ring-teal-400/30`. Contrast text on fill: teal-800 on teal-100 is about 6.9:1, teal-200 on teal-950 about 12:1; both pass.
- Teal is also the brand/action colour and the existing "Integrated Tourism Complex" chip. A tiny leading icon keeps it distinguishable from that chip: a 16px "stack of lines" (list) glyph before the text. The ITC chip has no icon. (Owner taste item 1.)

Text
- English: `From live listings · 7`. Arabic: `من الإعلانات النشطة · 7`. The number is Latin, placed after the dot. Words come from `provenance.LISTING_DERIVED`; the count is joined with " · ".
- The percentage is NOT shown on this badge (the other badges show it). The count is the honest measure here, and "30%" next to a real count would confuse. The confidence still appears inside the hover hint.
- If no count is passed (should not happen), show just the label.

Hover/tap hint (existing `Tooltip`, also opens on keyboard focus, so make the pill focusable like the Sample badge)
- `provenance.listingHint` then a second sentence `provenance.listingCount` (the "based on 7 listings" sentence) then the existing "Confidence: 42%" line. Max width stays `max-w-56`, it wraps to three short lines.

States: there is no loading state for the badge itself (it renders with its row). Where a row is still loading, the row's skeleton includes a pill-shaped grey block `h-5 w-28 rounded-full`.

Where it appears: admin stats table, review list, public neighbourhood overview cards, `/market` neighbourhood cards, compare page. Never a bare number. Also one new legend line on the marketing "honest data" block (`honestyLegendDerived`), shown as a fifth row with this same badge next to the sentence.

## 3. Screen A — Admin bulk upload `/admin/market-stats/import`

Purpose: the owner loads an official CSV, sees exactly what would be saved (or exactly what is wrong), and only then presses Import.

### 3.1 Phone (390px)

One column, top to bottom:
1. Back link at the top, small teal text with the direction arrow (copy `DirectionalLink` direction="back" as on the neighbourhood page), label "Market statistics" (existing `admin.marketStats`).
2. Title `adminImport.title`, 24px bold (`text-2xl`). Under it `adminImport.lede`, 14px grey.
3. Card "How it works": three numbered lines (`step1`, `step2`, `step3`) with big round numbers 1-2-3 (24px circles, teal-50 fill, teal-800 number). Below, the rule `levelRule` in small grey text.
4. Card "Your file" (the form):
   - Link-style button "Download template" (`template`), secondary variant, with a download glyph. Hover hint (NEW `adminImport.templateHint`): "An empty file with the right column names. Fill it in with one row per figure." / "ملف فارغ بأسماء الأعمدة الصحيحة. املأه بصف واحد لكل رقم."
   - Label "CSV file" (`file`). File picker: a full-width 44px-minimum button-shaped area that opens the phone's file chooser. Before choosing: greyed text "Choose a CSV file" (NEW `adminImport.chooseFile`: "Choose a CSV file" / "اختر ملف CSV"). After choosing: the file name (inside `dir="ltr"`, truncated in the middle) and size, "budget.csv · 42 KB", plus a small "x" remove icon button with hint "Remove file" (NEW `adminImport.removeFile`: "Remove file" / "إزالة الملف").
   - Tick-box row: the box is at least 24px with a 44px tap area covering the whole row; label `namesNeighborhood`; visible hint under it `namesNeighborhoodHint` (visible text, not just a tooltip, because this one changes what gets accepted). Unticked by default.
   - Primary button "Check file" (`check`), full width on phone. Disabled until a file is chosen. While working: "Checking…" (`checking`), disabled.
5. Results area (below the form): shows one of the states in 3.3.

Sticky action bar: once a preview with no problems exists, "Import {n} figures" moves into a bottom bar pinned to the screen (`position: sticky` at the bottom, white/stone-900 surface, a thin top ring, `pb` for the phone's home bar). This keeps the one primary action under the thumb after the long table. With problems, the bar shows the disabled Import button plus the short red sentence (see 3.3.3).

### 3.2 Laptop (1440px)

Two columns inside the 1152px frame, 32px apart.
- Start column (about 360px, sticky, stays in view while the right side scrolls): title, lede, the three-step card, the file card (form). The big number steps are compact.
- End column (the remaining width, about 760px): the results area. This is where the space goes: the preview and problem tables need width, so they live here instead of being pushed below the form.
- Empty state of the end column (before any file): a dashed-outline card (`ring-1 ring-dashed` style is reserved for Sample data badges, so use a plain `ring-stone-200` card with a large centred icon instead), centred text (NEW `adminImport.emptyTitle` / `emptyBody`): "Your preview will appear here" / "Nothing is saved until you press Import. Pick a file on the left and press Check file." · "ستظهر المعاينة هنا" / "لا يُحفظ شيء حتى تضغط استيراد. اختر ملفًا من الجانب ثم اضغط فحص الملف." In Arabic the file card is on the right, the preview on the left (mirrors automatically).
- The file picker becomes a drag-and-drop zone: 160px tall, dashed stone-300 outline, a file icon, "Drop a CSV file here, or choose one" (NEW `adminImport.dropHint`: "Drop a CSV file here, or choose one" / "أفلت ملف CSV هنا أو اختره"). On drag-over the outline turns teal and the fill teal-50. The same zone is keyboard-focusable and opens the chooser on Enter/Space. (**PROPOSED small pattern**, no library: just the native file input plus drag events.)
- "Import {n} figures" sits in the summary bar at the top of the preview (no bottom bar needed).

### 3.3 States (same in both sizes unless noted)

3.3.1 Empty: described above.

3.3.2 Checking (the server is reading the file)
- Button reads "Checking…" and is disabled; the file picker is disabled.
- The results area shows a skeleton shaped like the real thing: a summary bar block (`h-16 w-full`), then a table skeleton (`SkeletonTableRows rows={6} cols={5}`) inside a card. Dark mode uses the existing `dark:bg-stone-800` shapes.

3.3.3 Preview with no problems (ready)
- Summary bar (a card, emerald-tinted left edge `border-s-4 border-emerald-600`): a check icon and the text `summaryOk`, e.g. "12 figures ready · 3 will replace an existing figure · no problems". The "3 will replace" part is amber text when above 0. Row of actions at the reading-end of the bar (laptop): ghost "Choose a different file" and primary "Import 12 figures". Phone: the Import button is in the sticky bottom bar, "Choose a different file" stays under the summary bar.
- Small line under the bar: "These will be saved as" + the `ProvenanceBadge` for Official statistic at 90% (so the owner sees the label before confirming). Files with their own confidence column show each row's own badge in the table.
- Warnings (non-blocking): if the file had extra columns, an amber box above the table lists each one, `warnings.ignoredColumn`, e.g. "Column `notes` is not used and was ignored." (column name in `dir="ltr"`). Does not disable Import.
- Heading `previewHeading` ("Preview (first 50 figures)"), then the preview table (3.4.1).
- Preview-table cap: if more than 50 groups, a last grey line "…and 78 more figures will also be imported" (NEW `adminImport.moreFigures`: "…and {n} more figures will also be imported" / "…وسيُستورد {n} رقمًا آخر أيضًا").

3.3.4 Preview with problems
- Summary bar is red (`rose-50` fill, `border-s-4 border-rose-600`, dark `rose-950`), icon = warning triangle, text `summaryProblems`: "4 problems found. Fix the file and check it again. Nothing was saved."
- "Import" is disabled (greyed) and visible, with a hover hint (NEW `adminImport.importBlocked`): "Fix the problems in the list first." / "أصلح المشاكل في القائمة أولًا." Because disabled buttons don't get hover on touch, the red sentence already says the same.
- "Choose a different file" stays live (ghost), and is the natural next step.
- The problem table (3.4.2) comes first, ABOVE the preview table. The preview table of the valid groups is collapsed under a "Show the rows that are fine" toggle to keep the screen about the errors (NEW `adminImport.showGood`: "Show the figures that are fine" / "عرض الأرقام السليمة"). Default collapsed.
- File-level problems (missing column, empty file, wrong separator, not UTF-8, not a CSV, too big, too many rows) have no line number. They show as ONE rose box in place of the table: bold first line = the message, for example `errors.missingColumn`, with the column name in `dir="ltr"`. Several missing columns = several lines in the same box.

3.3.5 Importing
- Import button becomes "Importing…" and disabled. The summary bar stays. The table dims slightly (70% opacity). No page jump.

3.3.6 Imported (success)
- The whole results area is replaced by a green box (emerald, check icon): `done`, "Imported 12 official figures (3 replaced an existing figure)." plus a primary-variant link button `viewStats` "View market statistics" that goes to `/admin/market-stats`, and a ghost "Upload another file" (NEW `adminImport.another`: "Upload another file" / "رفع ملف آخر") that resets the form.
- Warm touch: a small grey line under it: "Every figure keeps its source link and the Official statistic label." / "يحتفظ كل رقم برابط مصدره وتسمية «إحصاء رسمي»." (NEW `adminImport.doneNote`).
- Partial failure: amber box, `donePartial`, same two buttons but the primary is "Check the file again".

3.3.7 Refused (nothing was read)
- One rose box above the file picker, message from `csvImport.errors.*` (`fileTooBig`, `tooManyRows` with {max}, `notCsv`, `notUtf8`, `wrongDelimiter`, `empty`), or `adminImport.rateLimited` ("Too many uploads. Try again in 12 minutes."), or `serverError`, or `notAllowed`. Rate-limited uses the amber box instead (it is not the file's fault). The picker keeps the file name so the owner sees what was refused; "Check file" is enabled again except while rate limited (then disabled, with the minutes in the message).

### 3.4 The two tables

Both tables use the existing pattern from `/admin/market-stats`: white card, `overflow-x-auto`, `text-sm` (Arabic lifted with `rtl:text-base`), header row `text-xs text-stone-500`, row divider `border-stone-100`. Column headers use `adminImport.col.*`.

3.4.1 Preview table
- Columns (in reading order): Area (`col.area`, bold, place name in the page language plus the level as a tiny grey line: governorate / city / neighbourhood) · Level is folded under Area to save width (the `col.level` header is used only for the screen reader) · Type (`col.type`, or "All types" = existing `market.allTypes`) · Month (`col.month`) · Figures (`col.figures`) · Label (the `ProvenanceBadge`) · Source (`col.source`) · Status (`col.status`).
- Figures cell: up to seven short lines "Average sale price  145,000.000" — label in small grey, number in `font-semibold`, Latin digits, aligned to the reading-end. For more than three figures the cell shows the first three and a small grey "+2 more" (hover hint lists all). Money 3 decimals; yield 2 decimals with %; counts whole.
- Source cell: host name only, e.g. `ncsi.gov.om`, as a link opening in a new tab (`dir="ltr"`, teal, truncated to 160px). Hover hint shows the whole address. A tiny "external link" glyph follows, mirrored by the page direction.
- Status cell: a pill. "New" (`status.new`) = neutral stone pill. "Replaces an existing figure" (`status.replaces`) = amber pill, followed by the badge of what is being replaced (small), so the owner sees, for example, that an Official figure is about to overwrite a Sample or a User submitted one. Hover hint on the amber pill (NEW `adminImport.replacesHint`): "A figure already exists for this area, type and month. Importing will overwrite it." / "يوجد رقم لهذا المكان والنوع والشهر. سيؤدي الاستيراد إلى استبداله."
- Phone: the table keeps a minimum width of 720px and scrolls sideways inside its card; the Area column is sticky at the start edge (`sticky start-0` with the card's background) so the owner always knows which row they are reading. A faint gradient on the far edge hints at more to scroll. In Arabic the scroll starts at the right edge and the sticky column is at the right.

3.4.2 Problem table (the one the owner will study)
- Laptop columns: Line (`col.line`, narrow, Latin digit, `tabular-nums`, bold) · Column (`col.column`, the file's exact header name in a small grey monospaced `dir="ltr"` chip) · Found (`col.found`, the cell's text in a stone-100 `dir="ltr"` chip, truncated at 24 characters with the whole value in the hover hint; an empty cell shows "(empty)" — NEW `adminImport.emptyValue`: "(empty)" / "(فارغ)") · Problem (`col.problem`, the full sentence in the page language, red-700 text; any column name/value inside it is wrapped `dir="ltr"`).
- Order: by line number, lowest first. Rows with several errors on one line repeat the line number (grouped visually by a slightly heavier top border), so the owner fixes one row at a time.
- In Arabic: the Line column is at the far right edge, Problem at the far left; the sentence reads right-to-left; chips read left-to-right inside it. This is the "error table reads right-to-left" requirement.
- Row count: show at most 200 rows, then one last row spanning the table: `moreProblems` "…and 37 more problems" (`{n}` Latin).
- The sentence strings begin "Line 14, column value:" so on the laptop the Line and Column columns duplicate that prefix. I have kept the approved strings unchanged (no new translations) and let the duplication stand; see owner taste item 2 for the cleaner option.
- Phone (below 640px): the table turns into stacked cards, one per problem, 8px apart, each `rounded-lg` with a rose start border (`border-s-4 border-rose-500`): top line = "Line 14" bold on the start side, the column chip at the end side; middle = the found-value chip; bottom = the sentence. No horizontal scrolling for problems: owners fix these on the go and a scroll-sideways error list is hard to read.
- Row hint: tapping/hovering a column chip shows the expected format, e.g. for `period_start` "Use the first day of the month, like 2026-01-01" (this reuses the sentence already inside `errors.badDate`; no new strings; chips without a matching hint show none).

3.5 Skeleton summary for this page: form card (title block `h-6 w-40`, three step rows `h-4`, picker `h-28`, button `h-10 w-32`) only if the page itself is ever slow; the admin section already has a `loading.tsx` shape (heading + table) that is reused for the page load. The preview region skeleton is in 3.3.2.

### 3.6 Taps and where they go
- Back link → `/admin/market-stats`. Download template → file download `/templates/market-stats-template.csv` (header row only). Check file → the preview appears in place (no navigation). Import → success box in place. View market statistics → `/admin/market-stats`. Source link in a row → the source web page in a new tab.
- Confirmation of outcome: the green "Imported…" box is the confirmation. After it appears the focus moves to the box (screen readers announce it; `role="status"`).

Reuse: copy layout and result-box idioms from `src/app/[locale]/(admin)/admin/market-stats/page.tsx` and `MarketStatForm.tsx` (Card, Label, Hint, Button, FieldError, result box, `overflow-x-auto` table); `Skeleton`/`SkeletonTableRows` from `src/components/ui/Skeleton.tsx`; `Tooltip`; `ProvenanceBadge`; `DirectionalLink`.

## 4. Screen B — Agency data upload `/agency/data`

Purpose: an approved agency sends market figures it knows about, and is told clearly that the owner checks them before anyone sees them.

Same skeleton as Screen A with these differences. Page frame `max-w-6xl` (the agency dashboard uses `max-w-4xl`; the preview table needs the room, so use 6xl here; the lede and form cards stay readable because they sit in the narrow start column on laptop).

Phone: title `agencyData.title`, lede `agencyData.lede`, then a **trust strip** directly under the lede: a small stone card with a lock-and-eye icon and the line "Not public until the owner approves" (NEW `agencyData.trustStrip`: "Nothing here is public until the site owner approves it." / "لا يظهر أي شيء هنا للعامة حتى يوافق عليه مالك الموقع."). Then the file card: template link (same hint), the file picker, the small grey line `limits` ("Up to 100 rows per file. Neighborhood rows are allowed; they are checked by the owner."), and "Check file" (`check`). There is NO neighbourhood tick-box and no level rule text. Steps card is shortened to two lines (download and fill in; upload and check) — reuse `adminImport` wording by copying the keys under `agencyData` as the behaviour spec allows, changing step 3 to `agencyData.done`-style wording: "Send for review. The owner approves each figure." / "أرسل للمراجعة. يوافق المالك على كل رقم." (NEW `agencyData.step3`).

Laptop: same two-column split as Screen A (form on the start side, preview on the end side). The agency column is slightly narrower (320px) because the form is simpler; the end column grows.

States
- Not approved: replaces the whole card stack. One amber box (same amber as the dashboard's "pending" banner, `agency.dashboard.pending` look) with `notApproved`, and under it a ghost link "Back to dashboard" (`back`). No template, no picker, no button. Warm extra line (NEW `agencyData.notApprovedHint`): "You will be able to upload as soon as the owner approves your agency." / "ستتمكن من الرفع فور اعتماد المالك لوكالتك."
- Queue full: amber box with `queueFull` ("You already have 200 figures waiting for review…"), the form hidden, link back to the dashboard.
- Empty (approved, nothing chosen): as Screen A's empty, with the trust strip.
- Checking: same skeleton as Screen A (3.3.2); "Checking…".
- Preview OK: summary bar says (NEW `agencyData.summaryOk`) "8 figures ready to send · 2 will be skipped because a figure already exists · no problems" / "8 أرقام جاهزة للإرسال · سيُتخطى 2 لوجود رقم موجود · لا مشاكل". Preview table columns as A, minus Level merged as in A. The Label badge column shows `User submitted 50%` (what they will get, never "Official"). Status pills: "New" (neutral) or "Skipped — a figure already exists" (amber; NEW `agencyData.status.skipped`: "Will be skipped — a figure already exists" / "سيُتخطى — يوجد رقم موجود"). Hover hint on the amber pill: "We never replace an existing figure with an uploaded one." / "لا نستبدل رقمًا موجودًا برقم مرفوع أبدًا." (NEW `agencyData.skippedHint`). Button: "Send 8 figures for review" (`submit`; the count excludes skipped ones). If all rows would be skipped, the button is disabled with the hint "Every row already has a figure" (NEW `agencyData.allSkipped`: "Every row already has a figure, so there is nothing to send." / "كل الصفوف لها أرقام موجودة، فلا شيء لإرساله.").
- Preview with problems: identical to A (red summary, problem table, sent button disabled); the error sentences are the shared `csvImport` ones. An agency that puts `OFFICIAL_STAT` or a `provenance` column in the file just sees it ignored with the amber warning (a file cannot ask for a label).
- Sending: "Sending…" (NEW `agencyData.sending`: "Sending…" / "جارٍ الإرسال…").
- Done: green box, `done` ("Received 8 figures. They are not public yet — the site owner reviews each one first."), and underneath, if any were skipped, an amber line `skipped` ("2 rows were skipped because a figure already exists…"). Buttons: primary `back` ("Back to dashboard"), ghost "Upload more data" (NEW `agencyData.another`: "Upload more data" / "رفع بيانات أخرى"). Warm touch: a small grey line "Thank you — every figure you share makes the market clearer." / "شكرًا لك — كل رقم تشاركه يجعل السوق أوضح." (NEW `agencyData.thanks`).
- Refused / rate limited: same as A, using `adminImport.rateLimited`-style wording copied under `agencyData`.

Dashboard change `/agency`: add one button to the quick-links card: `agencyData.dashboardButton` "Upload market data", `variant="secondary"` (the primary stays "Listings"), placed after Profile, wrapping naturally on phones. The button is hidden while the agency is not approved? No: it stays visible and leads to the "not approved" explanation (clearer than a missing button).

## 5. Admin Market-stats page `/admin/market-stats` (existing) — Builds A/C additions

Header row (the existing `flex flex-wrap items-center justify-between`): title on the start side; on the end side two buttons: secondary "Bulk upload official data" (`listingAverages.bulkLink`, icon = upload) and primary "Add market statistic" (existing). On phone they wrap under the title, full-width each, 8px apart, primary first.

**"Averages from live listings" panel** (Card, placed between the save-result message and the table; `mt-6`)
- Phone: title `panelTitle` (16px semibold) with the teal "From live listings" badge (no count) at the end of the line; body `panelBody` (14px grey); a small meta row; the button full-width under it.
- Laptop: a two-part row: start side = title + body + meta; end side = the button, vertically centred. Whole card is about 120px tall.
- Meta row (small grey, 12px; NEW strings):
  - `listingAverages.lastRun`: "Last computed: {date}. {n} averages currently live." / "آخر حساب: {date}. يوجد {n} متوسطًا حاليًا." The date/count are taken from the newest derived row (the page cannot know the run result after a reload because nothing is stored for it; see owner taste item 3). If none: `listingAverages.neverRun`: "Not computed yet — your shop is just warming up ☕." / "لم يُحسب بعد — ما زال الموقع يسخّن محركاته ☕." Since the owner asked for warmth, this is the one place for a light joke. Drop the emoji character itself if the team prefers no emoji (owner taste item 4); the sentence works without it.
- Button: secondary variant "Recompute now" (`recompute`), with hint (NEW `listingAverages.recomputeHint`): "Works out today's averages right now instead of waiting for the daily run." / "يحسب متوسطات اليوم الآن بدل انتظار التشغيل اليومي."
  - Default → hover → pressed → loading: label becomes "Working it out…" (`running`), disabled → done.
  - Done: emerald box under the panel text (inside the card) with `result` ("Done. 14 figures written, 2 left alone because an official or verified figure exists, 1 removed because there are now fewer than 5 listings."). The numbers are highlighted bold. The table below refreshes.
  - Nothing to average (0 written, 0 kept, 0 removed): same green box with the short warm line (NEW `listingAverages.nothing`): "Nothing to work out yet — a figure needs at least 5 live listings." / "لا شيء لحسابه بعد — يحتاج كل رقم إلى 5 إعلانات نشطة على الأقل."
  - Rate limited: amber box `rateLimited`. Error: rose box with `adminImport.serverError`-style wording copied under `listingAverages` (NEW `listingAverages.serverError`: "Something went wrong. Nothing was changed. Try again." / "حدث خطأ ما. لم يتغيّر شيء. حاول مرة أخرى.").
- Loading skeleton for the panel (if its last-run query is slow): title `h-5 w-48`, body two lines `h-4`, button `h-11 w-36`.

**Table changes (Build C owns this page)**
- The Source column shows the badge (derived rows with the count) and, under it on a second line, a small teal link "Source" (`admin.review.sourceLink` wording) when the row has a source web address, opening in a new tab; hover hint = the row's source note (truncated to about 200 characters). Needed so "source link on every row" of imported official figures is visible (the current table has no link). Derived rows have no link; their hint shows the "asking prices" note.
- Empty state unchanged, with one warm addition under the existing hint (NEW `admin.table.emptyBulkHint`): "Have an official file? Use Bulk upload." / "لديك ملف رسمي؟ استخدم الرفع الدفعي." linking to Screen A.

## 6. Admin review queue `/admin/review` (existing) — Build B additions

Each "Unverified market statistics" row keeps the existing Card row (`flex flex-wrap items-center justify-between gap-3`) but grows a second and third line:

Phone (stacked)
1. Place in bold: the governorate row now reads `governorateScope` ("Muscat governorate" / "محافظة مسقط"), never "National". City/neighbourhood as today; "Whole country" only when really national.
2. Meta line: `2026-03 · Villa ·` and the `ProvenanceBadge` (User submitted 50%, or the new badge if ever shown here with count).
3. Figures line (NEW; owner needs to see what they approve): up to three figures, e.g. "Avg sale 145,000.000 OMR · Rent 640.000 OMR". 3 decimals, Latin digits.
4. Source line: a small grey "Agency upload" chip (`admin.review.agencyUpload`; shown when the source note starts with the agency wording) followed by the source note text (2 lines max, expandable on tap, no hidden text), then the teal link "Source ↗" (`admin.review.sourceLink`) in a new tab (`dir="ltr"` for the address shown in the hover hint).
5. Buttons at the bottom, side by side each 50% width, 44px tall, 8px apart: "Mark verified" (emerald, existing look) and "Reject" (the existing rose-on-white look used for listings, `admin.review.reject`). Never adjacent to other tappable things closer than 8px.

Laptop: the same content on the start side in one block (place, meta, figures, source) and the two buttons stacked vertically or side by side at the end side (existing row pattern). Width used: the source note gets a full line instead of two.

Feedback: after "Mark verified" or "Reject" the page reloads with an emerald box at the top (same as the `?saved=` banner pattern on `/admin/market-stats`): NEW `admin.review.statVerified` "Figure approved — it is now public." / "تمت الموافقة على الرقم — أصبح متاحًا للعامة." and `admin.review.statRejected` "Figure rejected and removed." / "تم رفض الرقم وحذفه." (Reject deletes; per the behaviour spec there is no extra confirmation prompt — owner taste item 5 asks whether to add a one-tap undo.)

Sample rows keep hiding "Mark verified" (existing rule); "Reject" stays available on them.

Empty state: the existing `allClear` card. Skeleton: the review page is covered by the admin loading screen (heading + table); for this page rows are shaped as card blocks (`h-20 rounded-xl`), three of them.

## 7. Public market pages — Build D (governorate / city official figure card)

Purpose: show the official figure for the whole governorate or city, clearly NOT as the neighbourhood's own number.

### 7.1 Neighbourhood page `/market/[neighborhood]`

Placement: directly after the neighbourhood's overview cards and the existing `areaAverageNote` line, before the trend charts. Reason: the visitor meets the neighbourhood's own numbers first, then the wider official context before scrolling into charts. Section heading is NOT repeated; each card carries its own title.

Look (so it cannot be mistaken for the neighbourhood's own figure)
- Card with a sky-blue start edge (`border-s-4 border-sky-500`, same family as the Official badge) and a very light tinted background (`bg-sky-50/50`, dark `bg-stone-900` with `border-sky-400`). The neighbourhood cards above stay plain white, so the visual difference reads instantly. It is not dashed (dashed = Sample data).
- Top row: small map-pin glyph + title (`areaFigure.governorateTitle` "Muscat governorate, official", or `cityTitle` "Seeb, official") on the start side at 16px semibold; the Official statistic badge with its confidence at the end side.
- Body: one compact block per property type that has a row (All types, Apartment, Villa, in that order; hide types without data), each with a 12px grey label and a 2-column grid of the figures the row actually has (sale price, rent, price per m², yield). Figures are regular weight 16px, not the bold 18px teal used on the neighbourhood's own cards, so the neighbourhood numbers stay the stars. A figure missing in the row is simply left out (no "none" cells). Month at the end edge like the existing cards.
- Sentence under the blocks (`notThisArea`): "This is a figure for the whole Muscat governorate, not for Qurum on its own." at 14px (`rtl:text-base`), grey-700. Names in the page language.
- Laptop: when both a governorate row and a city row exist, they sit side by side in a 2-column grid (like the overview cards) — the city one first on the start side (closest to the neighbourhood), the governorate one second. On phone they stack with 16px between.
- Hover/tap hint on the Official badge: the existing `badgeHint` with the confidence.
- No card at all when there is neither a governorate nor a city row (no empty card, no placeholder).
- Loading: this section is part of the server-rendered page; the page's existing loading screen applies. Its skeleton shape: one card block `h-44 w-full` with the title line and two grey blocks.
- Error: if the query fails the section is simply absent (the page's own error boundary handles page-level failures); no red box for a context card.
- No source link or source note is shown publicly (as today; only admin sees them). If the owner wants the official source link published under the card, it is one line of small teal text (owner taste item 6).

### 7.2 Market index page `/market`

- Above "Neighborhoods" (the grid), a short section "Official area figures" (NEW `areaFigure.indexHeading`: "Official figures for whole areas" / "أرقام رسمية لمناطق كاملة") with one small card per governorate that has an official row for the selected property type (the existing Apartments/Villas tabs drive which row). Same sky-edge look and content as 7.1 but one property type only (the active one). Grid: 1 column on phone, 2 at `sm`, 3 at `lg`, same as the neighbourhood grid. Each card ends with the same `notThisArea` style line adapted for the index (NEW `areaFigure.indexNote`: "For the whole {area}; individual neighborhoods are below." / "لكامل {area}؛ الأحياء منفردة أدناه.").
- If there are governorate rows but no neighbourhood rows, the existing "No market data recorded yet" card stays and these governorate cards still show beneath it, so imported official data is never invisible.
- No governorate rows: the section is not rendered.

### 7.3 "From live listings" on public cards
- On a neighbourhood or index card whose latest row is derived, the badge reads "From live listings · 7" and the card's month text stays. Nothing else changes. On the compare page the badge also shows the count. Tooltip as in section 2 (so the word "asking" is always one hover away).

## 8. New strings needed beyond the approved string tables

All of these must be added to both `messages/en.json` and `messages/ar.json` in the same commit as the code. Arabic is unreviewed by a native speaker (same caveat as the behaviour spec). Namespace in the first column.

| Key | English | Arabic |
|---|---|---|
| adminImport.templateHint | An empty file with the right column names. Fill it in with one row per figure. | ملف فارغ بأسماء الأعمدة الصحيحة. املأه بصف واحد لكل رقم. |
| adminImport.chooseFile | Choose a CSV file | اختر ملف CSV |
| adminImport.dropHint | Drop a CSV file here, or choose one | أفلت ملف CSV هنا أو اختره |
| adminImport.removeFile | Remove file | إزالة الملف |
| adminImport.emptyTitle | Your preview will appear here | ستظهر المعاينة هنا |
| adminImport.emptyBody | Nothing is saved until you press Import. Pick a file and press Check file. | لا يُحفظ شيء حتى تضغط استيراد. اختر ملفًا ثم اضغط فحص الملف. |
| adminImport.moreFigures | …and {n} more figures will also be imported | …وسيُستورد {n} رقمًا آخر أيضًا |
| adminImport.importBlocked | Fix the problems in the list first. | أصلح المشاكل في القائمة أولًا. |
| adminImport.showGood | Show the figures that are fine | عرض الأرقام السليمة |
| adminImport.replacesHint | A figure already exists for this area, type and month. Importing will overwrite it. | يوجد رقم لهذا المكان والنوع والشهر. سيؤدي الاستيراد إلى استبداله. |
| adminImport.emptyValue | (empty) | (فارغ) |
| adminImport.another | Upload another file | رفع ملف آخر |
| adminImport.doneNote | Every figure keeps its source link and the Official statistic label. | يحتفظ كل رقم برابط مصدره وتسمية «إحصاء رسمي». |
| agencyData.trustStrip | Nothing here is public until the site owner approves it. | لا يظهر أي شيء هنا للعامة حتى يوافق عليه مالك الموقع. |
| agencyData.step3 | Send for review. The owner approves each figure. | أرسل للمراجعة. يوافق المالك على كل رقم. |
| agencyData.notApprovedHint | You will be able to upload as soon as the owner approves your agency. | ستتمكن من الرفع فور اعتماد المالك لوكالتك. |
| agencyData.summaryOk | {ready} figures ready to send · {skipped} will be skipped because a figure already exists · no problems | {ready} أرقام جاهزة للإرسال · سيُتخطى {skipped} لوجود رقم موجود · لا مشاكل |
| agencyData.status.skipped | Will be skipped — a figure already exists | سيُتخطى — يوجد رقم موجود |
| agencyData.skippedHint | We never replace an existing figure with an uploaded one. | لا نستبدل رقمًا موجودًا برقم مرفوع أبدًا. |
| agencyData.allSkipped | Every row already has a figure, so there is nothing to send. | كل الصفوف لها أرقام موجودة، فلا شيء لإرساله. |
| agencyData.sending | Sending… | جارٍ الإرسال… |
| agencyData.another | Upload more data | رفع بيانات أخرى |
| agencyData.thanks | Thank you — every figure you share makes the market clearer. | شكرًا لك — كل رقم تشاركه يجعل السوق أوضح. |
| listingAverages.recomputeHint | Works out today's averages right now instead of waiting for the daily run. | يحسب متوسطات اليوم الآن بدل انتظار التشغيل اليومي. |
| listingAverages.lastRun | Last computed: {date}. {n} averages currently live. | آخر حساب: {date}. يوجد {n} متوسطًا حاليًا. |
| listingAverages.neverRun | Not computed yet — your shop is just warming up. | لم يُحسب بعد — ما زال الموقع يسخّن محركاته. |
| listingAverages.nothing | Nothing to work out yet — a figure needs at least 5 live listings. | لا شيء لحسابه بعد — يحتاج كل رقم إلى 5 إعلانات نشطة على الأقل. |
| listingAverages.serverError | Something went wrong. Nothing was changed. Try again. | حدث خطأ ما. لم يتغيّر شيء. حاول مرة أخرى. |
| admin.table.emptyBulkHint | Have an official file? Use Bulk upload. | لديك ملف رسمي؟ استخدم الرفع الدفعي. |
| admin.review.statVerified | Figure approved — it is now public. | تمت الموافقة على الرقم — أصبح متاحًا للعامة. |
| admin.review.statRejected | Figure rejected and removed. | تم رفض الرقم وحذفه. |
| areaFigure.indexHeading | Official figures for whole areas | أرقام رسمية لمناطق كاملة |
| areaFigure.indexNote | For the whole {area}; individual neighborhoods are below. | لكامل {area}؛ الأحياء منفردة أدناه. |

The agency screen may copy the shared table-header and status keys under `agencyData` as the behaviour spec allows. "Skipped" wording for the status column exists only in the agency namespace.

## 9. Mobbin reference briefs (to be pulled by someone with the tool)

I could not call Mobbin here, so no URLs are attached. Pull these and paste `mobbin_url`s next to each line; they only inform taste, they never replace the app's own styling.

1. Bulk import with a preview-then-confirm step and a problem list: Shopify "Import products by CSV" (upload, then review), Notion "Import CSV", Airtable "CSV import" (field mapping preview), and a banking statement importer (e.g. Monzo, Wise bulk transfer CSV). Looking for: where the primary "Import" button lives after the preview, how the error count is shown in the bar, and whether the bad rows are listed first.
2. Data tables with per-row errors: Stripe or Mailchimp "audience import" error screens, Google Sheets data validation error list, Airtable "failed rows" view. Looking for: line number first, found value chip, plain-language reason, and what a mobile version looks like (stacked cards vs scrolling).
3. Empty and drag-drop file zones: Dropbox, Google Drive upload dialog, Notion import modal. Looking for: dashed zone copy and the drag-over state.
4. Data-source labels on property figures: Zillow "Zestimate" and "Redfin Estimate" labels, Bayut / Property Finder "market stats" and "price trends" cards, Bayut's "verified" listing tag. Looking for: how an estimate/official/listing-derived label sits beside a number and how a "based on N listings" line is phrased; RTL examples from Bayut's Arabic site for chip placement.

## 10. Design decisions that need the owner's taste

1. The new teal "From live listings" badge. Teal is also the main brand colour and the "Integrated Tourism Complex" chip, so I added a small list icon to tell them apart. The alternative is a different colour (for example rose or slate) for zero confusion with the brand, at the cost of adding a new colour family. My pick: teal plus icon.
2. Problem table duplicates the line and column because the approved sentences start with "Line 14, column value:". Keep (no new translations, slightly repetitive) or add a second short set of "reason only" sentences for the table (about 25 more strings in each language, cleaner look). My pick: keep for v1.
3. "Last run" panel: the behaviour spec asks for the last-run time and result but stores no run history (no new tables). I derived "last computed" from the newest derived figure; the full result text only appears right after pressing the button. If the owner wants the last result to persist across reloads, a small stored record is needed, which reopens the "no new tables" decision.
4. The warm joke on the never-computed state ("your shop is just warming up") and whether to keep the coffee emoji. The house style for this app has used no emoji; the sentence works without it.
5. Reject in the review queue deletes the figure with no extra prompt, as the behaviour spec decided. A one-tap "Undo" for ten seconds would protect against a mis-tap on a phone; it is a small addition if you want it.
6. Whether public visitors should see the official source link under the governorate card (more honest, links out to the government site) or keep every source link private as today.
7. Whether the governorate cards on `/market` sit above the neighbourhood grid (my pick, always visible) or below it (neighbourhood numbers stay first).

## Mobbin references (pulled by the main session, 30 Sep 2026)

- [Cofounder: Upload a CSV file](https://mobbin.com/flows/05b27b2d-c040-4bac-9692-492810e44df6): file picker with "N columns" summary and "This import will write rows into …", a preview table, one "Import CSV" button; on failure a red box listing "Row 2: … Row 3: …". → Same shape as Build A; our version names row **and** column and blocks the whole file before anything is written.
- [Supabase: Importing data](https://mobbin.com/flows/29a03902-356b-4af0-b982-da330f71e65a): side panel with Upload CSV / Paste text tabs, a format tip ("dates as YYYY-MM-DD"), "A total of 20 rows will be added", preview of the first rows, Cancel / Import data, success toast. → Borrow the "N rows will be added" line and the one-line format tip above the file box.
- [Neon: Importing a table](https://mobbin.com/flows/cd4c1741-c705-4571-9eca-bcdb30de33e3): "Review and create" step with separator/quote/header controls. → Not needed (we accept one fixed format and reject semicolons with a clear message), noted only as the pattern we deliberately skip.
