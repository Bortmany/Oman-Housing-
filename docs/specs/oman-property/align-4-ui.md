# Oman Property Intelligence — Step 4 "Listings for everyone": screen design (UI spec)

Companion to `docs/specs/oman-property/align-4-listings-for-everyone.md` (the approved build spec; its string tables in section 9 are the source of truth for wording). This file decides every screen question so builders A, B and C build instead of improvising. No code.

Written 30 Sep 2026. Phone = 390 px wide, laptop = 1440 px wide. English and Arabic (right-to-left) for every screen.

## 0. Read this first

**Mobbin: not available to me in this session.** I was given no Mobbin tool, so I am not citing any `mobbin_url`, and I am not claiming what Bayut, dubizzle, OpenSooq, Property Finder or Airbnb do. Every design choice below comes from the app's own design system and the design standards. Section 12 lists exactly which flows to pull (and what to look at in each) so the owner or dev-lead can attach real Mobbin links in a follow-up; none of the decisions below depend on them.

**Design system (there is no tokens file; the system is the existing Tailwind classes, which I matched exactly):**
- Brand: teal. Primary button `bg-teal-800` (dark `teal-600`), white text. Secondary = white with stone ring. Danger = `rose-700`. Ghost = teal text. All buttons are at least 44 px tall (`Button`, `ButtonLink` in `src/components/ui/Button.tsx`).
- Neutrals: stone. Page text `stone-900`, muted `stone-500` (dark `stone-400`). Cards: `Card` (`src/components/ui/Card.tsx`: rounded-xl, white, faint shadow, stone ring; dark = `stone-900` with `stone-800` ring, no shadow reliance).
- Inputs: `Input`, `Select`, `Textarea`, `Label`, `Hint`, `FieldError` (`src/components/ui/Field.tsx`): 44 px min height, stone ring, teal focus ring, rose ring + rose message for errors.
- Phone inputs: `PhoneField` / `usePhoneField` in `src/components/ui/ContactFields.tsx` (code picker + greyed example, LTR pair).
- Status colours (already in `StatusPill.tsx`): draft = stone, in review = amber, live = emerald, not approved = rose, sold/rented = sky, withdrawn = stone-muted.
- Type: one family; `text-2xl font-bold` page title, `text-base font-semibold` card title, `text-sm` body, `text-xs` hints and pills. Price = `text-lg font-bold text-teal-800` (dark `teal-300`). Arabic small text bumps with `rtl:text-sm` as `ListingCard` does. Only four sizes are used below.
- Spacing in multiples of 4: 8 inside a group, 16 between a card's parts, 24 between cards, 32 between page sections.
- Loading: `Skeleton`, `SkeletonPropertyCard`, `SkeletonTableRows` (`src/components/ui/Skeleton.tsx`). Hover hints: `Tooltip` (`src/components/ui/Tooltip.tsx`).
- Notices: the green notice used on the agency listings page (`emerald-50` fill, `emerald-800` text, ring) = success. I define the matching amber (warning/info-neutral) and rose (error) notices by the same recipe, no new hues: see "Notice recipes" below.

**Notice recipes (reuse, one family):** success = emerald-50 / emerald-800 / ring emerald-600/20 (dark emerald-950 / emerald-300). Warning = amber-50 / amber-900 / ring amber-600/20 (dark amber-950 / amber-200). Error = rose-50 / rose-800 / ring rose-600/20 (dark rose-950 / rose-300). Information = sky-50 / sky-800 (dark sky-950 / sky-200). Rounded-lg, `px-4 py-3`, `text-sm`, an icon 20 px at the start edge.

**One proposed addition to the design system (ONE, as required):** a shared **`Notice`** component with the four recipes above (success / warning / error / info), so the six places below that need a notice do not each re-style one. It lives in `src/components/ui/Notice.tsx` (builder A creates it; B and C use it). It uses only colours already in the app.

**Conventions carried everywhere:** logical spacing only (`ms-/me-/ps-/pe-/text-start`); `rtl:` only for mirroring glyphs and Arabic type size; Latin digits for numbers, money, phone and codes (wrapped `dir="ltr"`); every link through `src/i18n/navigation.ts`; every control at least 44 x 44 px; errors sit under the box that caused them.

**Files to copy from (by path):**
- Page shell and listing list: `src/app/[locale]/(agency)/agency/listings/page.tsx` (max-w-5xl shell, title row, green notice, empty Card).
- Listing card: `src/components/marketplace/ListingCard.tsx` (cover image + price + title + meta layout).
- Status pill: `src/components/marketplace/StatusPill.tsx` (A's `OwnStatusPill` wraps the same colours with the `myListing.status.*` words).
- Contact card: `src/components/marketplace/ContactButtons.tsx`.
- Phone entry: `src/components/ui/ContactFields.tsx`.
- Existing agency form: `(agency)/agency/listings/AgencyListingForm.tsx`; admin photo upload on the admin property form.
- Header/footer: `src/components/layout/Header.tsx`, `Footer.tsx`, `NavLink.tsx`.

---

## 1. Owner "My properties" — `/account/listings` (A1)

**Purpose:** one place to see every property I have listed, what state it is in, and what to do next.

### 1.1 Phone (390 px)

Top to bottom, single column, `px-4`, `py-8`:
1. **Title** "My properties / عقاراتي" (`text-2xl font-bold`). Under it, the lede (`text-sm` muted, 8 px below).
2. **Primary action block** (16 px below the lede), one of three, never two:
   - Phone not verified: a Card (amber info tint) with the title "Verify your phone to start / أكّد رقم هاتفك للبدء", one line "Takes about a minute. We text you a code." and a full-width primary button "Verify my phone / تأكيد رقم هاتفي" leading to section 2.
   - Verified and slot free: full-width primary "Add a property / إضافة عقار".
   - 3 of 3 used: no button. A sky info `Notice` with `owner.list.capReached`. (Never a greyed button.)
3. **Cap line** `owner.list.capLine` ("1 of 3 live or in-review listings used."), `text-xs` muted, with a small progress bar (three small segments, filled teal-700 for used, stone-200 for free; decorative, `aria-hidden`; the sentence carries the meaning). Hover hint on the segments: "Drafts don't count toward the limit." / "المسودات لا تُحتسب ضمن الحد."
4. **Success notice** after sending for review: green `Notice` with `owner.list.submittedNotice`, dismissible (x, 44 px), auto-removed from the address so a refresh doesn't repeat it.
5. **Listing cards, stacked one per row, 16 px apart** (whole list in a column, no table, no sideways scroll; there is no table at any width for owners). Each card (`Card`, padding 0), top to bottom:
   - Cover photo, 16:9, `object-cover`, rounded at the top. No photo: stone-100 block with "No photos yet / لا توجد صور بعد" and a small camera-off icon; for a draft with no photo an extra line "Add photos to send it for review." appears under it.
   - Body, `p-4`, gap 8: price (`text-lg font-bold text-teal-800`, with "per month / per year" small and muted beside it for rentals; it sits at the reading-end of its row: right in English, left in Arabic, opposite the Sale/Rent chip); title (`font-medium`, in the page language, two lines then ellipsis); neighbourhood and type (`text-xs`, muted).
   - Status row: `OwnStatusPill`, then below it the plain-words hint (`myListing.hint.*`, `text-xs`, muted, up to three lines). A rejected card shows the admin reason in a rose-50 block: "Why it wasn't approved: ..." so the owner sees it without opening the card.
   - Action row: one button, full width, 44 px. Live/in review/other: secondary "Open / فتح". Draft: primary "Continue / متابعة". The whole card is also a link (same destination) with a pressed state (stone-50 fill).
   - The Sale/Rent chip and status pill never overlap: chip top-end of the body row, pill on its own row.
6. **Footer of page:** 32 px space, then nothing (the site footer).

### 1.2 Laptop (1440 px)

- Shell `max-w-5xl` centred (same as agency listings, about 1024 px); the rest of the screen is left empty and calm on purpose. Title left (right in Arabic), "Add a property" button at the opposite end of the same row, auto width (not full width). The cap line sits under the title with the progress segments inline.
- Cards in **two columns**, 24 px gap; each card keeps the phone layout (cover on top). The photo area is 4:3 at this width so two cards fit one screen. No third column: long titles and a status hint need the room.
- Unverified-phone card is full width of the shell with the button at the end edge.
- Hover: card lifts with a stone ring darkening by one step (no movement); "Open" button shows its standard hover.

### 1.3 States

| State | What the owner sees |
|---|---|
| Loading | `loading.tsx`: title and lede as real text, then the cap-line skeleton (one `h-3 w-48` bar) and two `SkeletonPropertyCard`s (one column on phone, two on laptop). Grey blocks `stone-200`, dark `stone-800`, gentle pulse. |
| Empty | Centred Card: a small house outline icon, the line "You haven't listed a property yet." and "Add your first property. It's free, and we check it before it goes public." Plus a primary button (if verified) or the verify button (if not). Warm line added under (new string `owner.list.emptyWarm`): EN "Your first listing is one phone call away from a buyer." AR "إعلانك الأول على بُعد اتصال واحد من مشترٍ." |
| Error loading | Rose `Notice`: "We couldn't load your properties. Refresh the page, and if it keeps happening, try again in a few minutes." (new string `owner.list.loadError`), with a "Try again" secondary button that reloads. |
| Success | Green notice as in 1.1 item 4. |
| Signed out / agency / admin | Redirected before anything shows (see the build spec A); no screen. |

### 1.4 Every tap
- "Verify my phone" -> section 2. "Add a property" -> `/account/listings/new` (section 3). Card / "Open" -> `/account/listings/[id]` (section 5). "Continue" (draft) -> the same page, form scrolled into view. Notice x -> hides it.

### 1.5 Words
Existing keys: `owner.title`, `owner.lede`, `owner.newListing`, `owner.list.*`, `myListing.status.*`, `myListing.hint.*`. New keys (owner block):

| Key | English | Arabic |
|---|---|---|
| `owner.list.verifyCta` | Verify my phone | تأكيد رقم هاتفي |
| `owner.list.needsPhoneBody` | Takes about a minute. We text you a code. | يستغرق نحو دقيقة. سنرسل إليك رمزًا برسالة نصية. |
| `owner.list.emptyWarm` | Your first listing is one phone call away from a buyer. | إعلانك الأول على بُعد اتصال واحد من مشترٍ. |
| `owner.list.loadError` | We couldn't load your properties. Refresh the page, and if it keeps happening, try again in a few minutes. | تعذّر تحميل عقاراتك. حدّث الصفحة، وإذا تكرر الأمر فحاول بعد دقائق. |
| `owner.list.capHint` | Drafts don't count toward the limit. | المسودات لا تُحتسب ضمن الحد. |
| `owner.list.dismiss` | Dismiss | إغلاق |
| `owner.list.noPhotosAddHint` | Add photos to send it for review. | أضف صورًا لإرساله للمراجعة. |
| `owner.list.tryAgain` | Try again | حاول مجددًا |

---

## 2. Phone-code verification — `/account/listings/verify-phone` (A2)

**Purpose:** prove the owner's Omani mobile so buyers can reach a real person and fake listings stay out.

One screen, one Card, centred narrow column (`max-w-md`, the same at 390 px and 1440 px: on laptop it sits centred with generous space either side; nothing stretches). The card never changes height between steps by more than one field: the two steps share a fixed header and the footer button row stays at the same vertical position.

Header of the card (both steps): small shield-check icon (20 px, teal), title `owner.verify.title`, then `owner.verify.why` (`text-sm` muted). A 2-dot step indicator under it ("Step 1 of 2 / الخطوة 1 من 2", new string) so the owner knows it is short.

### 2.1 Step 1 — enter the number
- Label `owner.verify.phoneLabel`. Input row built on `PhoneField` with the country code **locked to Oman +968** and shown as a read-only chip, not a dropdown (spec A2 fixes +968; a dropdown that cannot change would be a dead control). The chip has a hover/press hint: "Only Oman numbers for now." / "أرقام عُمان فقط حاليًا." The row stays LTR in Arabic, like `PhoneField`.
- Greyed example in the box: `9123 4567` (Arabic UI too; digits are Latin). Hint under it `owner.verify.phoneHint`.
- Numeric keypad (`inputMode="tel"`), 44 px tall.
- Primary button full width "Send code". Loading: label becomes a spinner + "Sending..." / "جارٍ الإرسال..." and the box is disabled. Disabled when the number is empty or impossible (the error shows on blur, not while typing).
- Errors (rose, under the box): `owner.verify.errors.invalidPhone`, `phoneInUse`, `rateLimited`, `sendFailed`. Box gets the rose ring.
- Dormant provider (production, SMS not keyed): the whole step is replaced by an amber `Notice` with `owner.verify.notAvailable` and a secondary "Back to my properties" button. No input is shown (nothing to submit).

### 2.2 Step 2 — enter the code
- Green-tint line at the top of the step: `owner.verify.codeSent` with the number (LTR) bold.
- **One** code box, not six separate boxes: wide letter-spacing, `text-xl` (the only place above 18), centred, LTR even in Arabic, numeric keypad, `autocomplete="one-time-code"`, placeholder `123456` in light grey. One box works with the phone's "paste code from message" suggestion and with RTL without any digit-order bug. (Owner-taste item #1.)
- Primary button "Confirm" full width. Loading: spinner + "Checking..." (`owner.verify.checking`).
- Under the button, a row of two text buttons (each 44 px tall): "Send a new code" and "Use a different number". "Send a new code" is **disabled for 60 seconds** and shows the live line `owner.verify.resendWait` ("You can ask for a new code in 42 seconds."); when the wait ends the button becomes active and the line disappears. After a resend: a small green line "New code sent." (`owner.verify.resent`).
- Error states, all shown as a rose message directly under the code box, the box turns rose, and the box is cleared and re-focused:
  - **Wrong code** `errors.wrongCode`; after the 3rd wrong try a second line in muted text: "2 tries left." (`owner.verify.triesLeft`, plural-aware).
  - **Expired** `errors.expired`: the Confirm button is disabled, "Send a new code" is highlighted as the primary button (swap of emphasis) and is enabled if the 60-second wait is over.
  - **Too many tries** `errors.tooManyTries`: same treatment as expired.
  - **Rate limited** `errors.rateLimited`: the resend control is disabled with that message.
- Success: the card becomes a green confirmation (check icon, `owner.verify.done`), and after about 1.5 seconds the page moves on to the Add form. A "Continue" button is shown too, so nobody is stuck if the redirect is slow.
- Loading the page itself: a card skeleton (title bar, one input-height bar, one button-height bar).

### 2.3 Words (new)
| Key | English | Arabic |
|---|---|---|
| `owner.verify.step` | Step {n} of 2 | الخطوة {n} من 2 |
| `owner.verify.codeChip` | Only Oman numbers for now. | أرقام عُمان فقط حاليًا. |
| `owner.verify.sending` | Sending... | جارٍ الإرسال... |
| `owner.verify.checking` | Checking... | جارٍ التحقق... |
| `owner.verify.resent` | New code sent. | تم إرسال رمز جديد. |
| `owner.verify.triesLeft` | {count, plural, one {# try left.} other {# tries left.}} | {count, plural, one {بقيت محاولة واحدة.} two {بقيت محاولتان.} few {بقيت # محاولات.} many {بقيت # محاولة.} other {بقيت # محاولة.}} |
| `owner.verify.backToList` | Back to my properties | العودة إلى عقاراتي |
| `owner.verify.continue` | Continue | متابعة |
| `owner.verify.codePlaceholder` | 123456 | 123456 |

---

## 3. The shared listing form — `ListingForm` (A5), used at `/account/listings/new`, `/account/listings/[id]`, `/agency/listings/new`, `/agency/listings/[id]`

**Purpose:** one calm form that never loses typing, takes photos, and says exactly which box is wrong.

### 3.1 Order of the page, top to bottom (phone; laptop notes in 3.7)
1. **Draft-restored notice** (only when the browser has a saved draft): sky `Notice` with icon, `myListing.form.draftFound`, then a line `draftPhotosNote`, then two buttons on one row, 44 px each: primary "Restore / استعادة" and secondary "Start fresh / البدء من جديد". On Restore: the boxes fill (both English and Arabic halves), the notice turns into a small green "Restored." line for 4 seconds (new `myListing.form.draftRestored`). On Start fresh: the notice disappears and the saved copy is deleted.
2. **Error summary** (only after a failed submit): rose `Notice` with `myListing.errors.summary` and a short list of the failing boxes, each a link that jumps to and focuses that box. It is announced to screen readers. Hidden until needed; appears above the photo box.
3. **Photos** card (section 3.2).
4. **The property** card: neighbourhood, type, ownership, title EN/AR, description EN/AR, bedrooms, bathrooms, built area, year built.
5. **The offer** card: sale/rent, price (OMR), rent period (only when Rent is chosen).
6. **Owner confirmations** card (owners only, section 3.5).
7. **Submit area** (section 3.6).

Each card is a `Card`, 24 px apart. Inside a card: label above box, 16 px between fields, 4 px between a label and its hint. Required boxes carry a small "Required / مطلوب" text after the label (not only an asterisk: the asterisk alone is not readable to everyone). Optional boxes say "Optional / اختياري".

### 3.2 The photo box

**At the top of the card:** title `Photos` + live counter at the end edge: "3 of 15" (`myListing.form.photosCount` style; Latin digits). Under the title: `photosHint` (muted `text-xs`) and `photosRights` (muted, with a small info icon; hover hint on the icon: "Photos are reviewed by our team before anything goes public." new string `photosReviewTip`).

**The add area (empty state, nothing chosen yet):** a dashed-border box, stone-300 (dark stone-700), 160 px tall on phone and 200 px on laptop, containing a photo-plus icon, the line "Add photos of the property / أضف صور العقار", the muted line "Up to 15 photos, 5 MB each" and a secondary button "Choose photos" (the real tap target: the whole box is tappable too). Laptop: the box also accepts dragging files in, with a teal dashed border and "Drop to add / أفلت للإضافة" while dragging over it. On phone the button opens the camera/gallery chooser.

**With photos:** a grid of thumbnails, **2 across on phone, 4 across on laptop**, 8 px gap, each a square (`aspect-square`, `object-cover`, rounded-lg). The add box shrinks to a tile at the end of the grid (a "+ Add" square with the same dashed border) until 15 is reached, then it disappears and is replaced by the line "You've added the maximum of 15." (new `photosMax`).

**Each thumbnail tile (phone-safe: nothing relies on hover):**
- The first photo wears a **"Cover" chip** (teal-800 fill, white text, at the top start corner, on the photo with a small dark gradient strip behind it so it stays readable on any photo).
- Under the picture, inside the tile (not over the picture), a row of four icon buttons, each 44 x 44 px, evenly spread: **Make cover** (star; hidden on the cover itself and replaced by a filled star that is disabled, hint "This is the cover"), **Move earlier** (arrow), **Move later** (arrow), **Remove photo** (bin, rose icon, separated from the others by a 8 px gap and a thin divider so it cannot be hit by accident). "Earlier/later" arrows mirror in Arabic with `rtl:rotate-180`: earlier always points toward the start of reading (left in English, right in Arabic). Earlier is disabled on the first photo, later on the last.
- Every icon button has a hover hint and an `aria-label` from `myListing.form.photoMakeCover/photoEarlier/photoLater/photoRemove` (tooltip via `Tooltip`; on phone, long-press shows it, and the labels are read by screen readers).
- Below the row a text link "Describe this photo (optional)" expands two boxes (English, Arabic) with the `photoAltHint`. Collapsed by default.
- **Remove** asks nothing for a photo that is not saved yet (it just goes). For a photo already saved on a draft it shows an inline two-button confirm in the tile ("Remove? Yes / No"), because a removal is permanent.

**Per-photo states (shown on the tile, over the picture with a gradient strip, never text straight on the photo):**
- *Chosen, waiting:* thumbnail with a small "Waiting" grey chip.
- *Uploading:* a thin teal progress bar along the bottom of the tile and the word "Uploading" (the overall line "Uploading 2 of 3..." sits above the grid and is announced politely to screen readers). Its four buttons are disabled.
- *Uploaded:* a small green check chip (fades after 2 seconds; the tile then looks normal).
- *Failed (size, type, server, limit):* the thumbnail is dimmed, a rose ring surrounds the tile, and **under the tile** (inside the grid cell, rose text) the named reason: `photoErrorSize` / `photoErrorType` / `photoErrorFailed` (with the file name). Two buttons in the tile: "Try again" (secondary) and "Remove photo". The same message is **also** collected in a rose list directly under the whole grid ("These photos need attention"), so nothing is hidden if the tile is off-screen.
- *Too many chosen at once:* the extra files are refused together with one message `photoErrorLimit` under the grid; the allowed ones are still added.
- *Rate limited:* rose `Notice` under the grid with `photoRateLimited`.
- *Owner has zero photos at submit:* `ownerPhotoRequired` under the add box; the box itself gets a rose dashed border and scrolls into view.

**Skeleton (editing a saved listing):** while saved photos load, the grid shows grey squares of the same size (2 or 4 across), pulsing, with a small grey bar under each.

**Saved photo (already on the draft):** identical to an uploaded tile, without the "Waiting" state.

### 3.3 Fields, examples and errors

- Text fields use the existing labels (`admin.property.*`, `admin.listing.*`) and `Input/Select/Textarea`. Greyed example text (`placeholder`) in every text box, in the page language: title EN "Modern 4-bedroom villa in Al Khuwair", title AR "فيلا حديثة من 4 غرف في الخوير", description "Quiet street, close to schools, parking for two cars.", price "185,000", built area "320", year "2019". Examples use the `admin.examples.*` keys where they exist (builder checks; add missing ones in the `myListing.form` block).
- **Price box:** a fixed "OMR / ر.ع." unit chip at the end of the box (non-editable), numeric keypad. Live display under the box in muted text of what the buyer will see: "Buyers will see: OMR 185,000" using `formatOMRWhole` (helps catch a missing zero).
- **Rent period** appears only when Rent is selected, with a soft reveal (no jump: reserved space is not needed; it pushes content down once and focuses nothing).
- **Dropdowns** come back as chosen after any error (spec A5).
- **Errors:** every failing box gets the rose ring and its own message directly under it, in the page language, naming what is wrong ("The price must be more than zero."). The **server returns all failing boxes at once**; all show together. Empty submit: stopped in the browser, focus jumps to the first empty required box, and the error summary appears. Live check: a box is judged on blur (leaving it), not on the first keystroke.
- **Paired boxes (English + Arabic):** shown stacked on phone (English first, then Arabic, each with a small language tag "EN" / "AR" chip next to the label). The Arabic box is `dir="rtl"` whatever the page language, the English box `dir="ltr"`. A character counter (`text-xs`, muted, end edge) shows on descriptions: "120 / 2000" (max from the existing rule).
- Tooltips (hover hints, both languages): ownership ("Do you hold the title deed? Choose 'Ownership not confirmed' if unsure." / "هل تملك صك الملكية؟ اختر «الملكية غير مؤكدة» إن لم تكن متأكدًا."); built area ("Inside walls, in square metres." / "المساحة المبنية بالمتر المربع."); the Cover star; the "Required" text needs none.

### 3.4 Autosave / draft behaviour (what the owner feels)
- No visible save button for the browser copy. A tiny muted line at the end of the form header: "Draft kept on this device" with a check (appears after the first keystroke; `myListing.form.draftKept`, new). It is honest that it is on this device only.
- When the listing is also saved on the server as a `DRAFT` (after the first Submit attempt): the status pill at the top of the page reads "Draft — not sent yet".

### 3.5 Owner-only confirmations (A3), at the bottom of the form, in their own Card
- Two checkboxes, each in a row at least 44 px tall, the whole row tappable: `owner.form.ownerConfirm` and `owner.form.phoneConsent` (with the verified number in LTR, bold).
- Unticked on submit: each shows `owner.form.tickRequired` in rose directly under its row, the box outline turns rose.
- Below them, the info line `owner.form.reviewNotice` with an info icon.

### 3.6 Submit area
- Full-width primary button on phone "Submit for review" (new listing) or "Save changes" (edit), **sticky to the bottom of the screen** on phone (a bar `bg-white` with a top ring, `pb` for the phone's safe area, 12 px padding), so it is always reachable on a long form. Laptop: not sticky; normal button at the end edge of the form, auto width, with "Save as draft" as a secondary button beside it (owners and agencies can save without sending; the same draft mechanism; new `myListing.form.saveDraft` = "Save as draft / حفظ كمسودة"). On phone "Save as draft" is a text button above the sticky bar's primary.
- Under the button, muted: `submitNotice` (new listing) or `editNotice` (live listing being edited).
- **Button states:** default; pressed (one step darker, `active:` tone); disabled while working; **loading** swaps the label through the stages: "Saving..." -> "Uploading 2 of 3..." -> "Sending for review..." (each a string; the last is new `myListing.form.sending`). The button is not disabled for being "incomplete" (an incomplete form should say what is missing, not look broken).
- Outcome: success takes the owner to `/account/listings?submitted=1` (owner) or the agency list (agency) where the green notice confirms the OUTCOME. A failed photo leaves the owner on the form with the failing tile highlighted and a rose notice at the top: "Your listing is saved as a draft. One photo didn't upload — fix it below and press Submit again." (new `myListing.form.partialFail` / AR "تم حفظ إعلانك كمسودة. لم تُرفع صورة واحدة — عالجها أدناه ثم اضغط إرسال مرة أخرى.").
- Errors not tied to a box (rate limit, draft limit, wrong state) appear as a rose `Notice` directly above the submit button, using `myListing.errors.*`.

### 3.7 Laptop layout (1440 px)
- Shell `max-w-3xl` centred (about 768 px; a form reads best narrower than the list pages). Not a two-page-wide monster.
- Photos card first at full width, thumbnails 4 across. Drag the files in is supported (visual cue above).
- Paired fields (neighbourhood/type; ownership/year; bedrooms/bathrooms/area; price/rent period) sit **two per row**; English and Arabic title/description stay stacked, because comparing languages side by side invites typos in one language.
- Right rail on laptop only (`lg:` and above, about 280 px, sticky): a small "Before you send" checklist Card that ticks itself live: Photos added (owner), Title, Price, Confirmations (owner). Each line has a grey circle that turns green with a check when satisfied. It fills the otherwise unused space and answers "what's still missing?" without an error. It is informational, not blocking. (Phone: this checklist is the error summary only.) Builder note: this is decoration-free progress, all strings `myListing.form.checklist*` (new).
- Submit bar not sticky; sits under the form.

### 3.8 Loading and error of the form page itself
- Loading an existing listing: skeleton of the status row (pill-shaped bar), the photo grid squares, and 6 input-height bars in two columns on laptop.
- Not found / not yours: the standard not-found page (identical for both cases).

### 3.9 New strings (myListing.form additions)
| Key | English | Arabic |
|---|---|---|
| `myListing.form.required` | Required | مطلوب |
| `myListing.form.optional` | Optional | اختياري |
| `myListing.form.addPhotosTitle` | Add photos of the property | أضف صور العقار |
| `myListing.form.addPhotosLimits` | Up to {max} photos, {size} MB each | حتى {max} صورة، {size} ميغابايت للصورة |
| `myListing.form.photosDrop` | Drop to add | أفلت للإضافة |
| `myListing.form.photosMax` | You've added the maximum of {max}. | وصلتَ إلى الحد الأقصى وهو {max} صورة. |
| `myListing.form.photosReviewTip` | Photos are reviewed by our team before anything goes public. | يراجع فريقنا الصور قبل نشر أي شيء للعموم. |
| `myListing.form.photoIsCover` | This is the cover | هذه هي صورة الغلاف |
| `myListing.form.photoWaiting` | Waiting | بالانتظار |
| `myListing.form.photoUploadingOne` | Uploading | جارٍ الرفع |
| `myListing.form.photoRetry` | Try again | حاول مجددًا |
| `myListing.form.photoRemoveConfirm` | Remove this photo? | هل تريد حذف هذه الصورة؟ |
| `myListing.form.photosNeedAttention` | These photos need attention | هذه الصور تحتاج إلى انتباه |
| `myListing.form.draftRestored` | Restored. | تمت الاستعادة. |
| `myListing.form.draftKept` | Draft kept on this device | المسودة محفوظة على هذا الجهاز |
| `myListing.form.priceSeen` | Buyers will see: {price} | سيرى المشترون: {price} |
| `myListing.form.saveDraft` | Save as draft | حفظ كمسودة |
| `myListing.form.sending` | Sending for review... | جارٍ الإرسال للمراجعة... |
| `myListing.form.partialFail` | Your listing is saved as a draft. One photo didn't upload — fix it below and press Submit again. | تم حفظ إعلانك كمسودة. لم تُرفع صورة واحدة — عالجها أدناه ثم اضغط إرسال مرة أخرى. |
| `myListing.form.checklistTitle` | Before you send | قبل الإرسال |
| `myListing.form.checklistPhotos` | At least one photo | صورة واحدة على الأقل |
| `myListing.form.checklistTitleDone` | A title | عنوان للإعلان |
| `myListing.form.checklistPrice` | A price | السعر |
| `myListing.form.checklistConfirm` | Confirmations ticked | وضع علامة على الإقرارات |
| `myListing.form.tipOwnership` | Do you hold the title deed? Choose "Ownership not confirmed" if unsure. | هل تملك صك الملكية؟ اختر «الملكية غير مؤكدة» إن لم تكن متأكدًا. |
| `myListing.form.tipArea` | Inside walls, in square metres. | المساحة المبنية بالمتر المربع. |

---

## 4. One listing — `/account/listings/[id]` (A4) and `/agency/listings/[id]` (B2), with the action panel (4.3 of the build spec)

**Purpose:** see a listing's state, act on it (edit, take it down, resend), and for owners read buyer enquiries.

### 4.1 Phone (390 px), top to bottom
1. **Back link** "Back to my listings" (44 px tap, `DirectionalLink` so the arrow mirrors in Arabic).
2. **Title** (`text-2xl`, two lines then clamp) then the `OwnStatusPill` and, 8 px under, its plain-words hint. If rejected: rose block with `myListing.rejectedReason` (or "No reason was given." if none: new `myListing.noReason`).
3. **Quick row**: cover thumbnail (64 px square, rounded) at the start with price and neighbourhood beside it. If live, a secondary button "View as a buyer" (opens `/properties/<propertyId>` in the same tab).
4. **Action panel** (a Card titled "What would you like to do?" / "ماذا تريد أن تفعل؟", new `myListing.actionsTitle`). Buttons stacked full width, 12 px apart, **only the ones that apply** (never greyed out ones that don't):
   - Live: secondary "Edit" (scrolls to the form), then a divider, then a rose-outline-text button "Take it off the site" (it is not filled red: destructive but reversible; the filled `danger` style is saved for "Delete draft").
   - In review: secondary "Edit", and "Withdraw" (same take-down panel, only "Just withdraw it for now" offered since it was never live).
   - Draft: primary "Continue" (scrolls to form); after a divider, `danger`-outline "Delete draft".
   - Rejected / Withdrawn / Sold / Rented: primary "Send for review again"; secondary "Edit".
   - **Take it off the site** opens an inline panel right under the button (not a pop-up that hides context): radio rows at least 52 px tall, "It's been sold" (sale only) / "It's been rented" (rent only) / "Just withdraw it for now"; below the chosen row the consequence line (`soldBody` / `rentedBody` / `withdrawBody`, `text-sm`); then two buttons side by side at equal width: `Confirm` (danger filled) and `Keep it live` (secondary, and it is the default focused one, so Enter does not take a listing down). Loading: Confirm shows a spinner and "Working...". Outcome: the panel closes, the pill updates, and a green notice "Done. Your listing is now marked as sold." (new `myListing.doneSold/doneRented/doneWithdrawn`).
   - **Send for review again:** one tap, confirmation line `resubmitBody` shown under the button for that moment and a loading state; outcome green notice "Sent. Our team will review it." (`myListing.doneResubmit`). If the owner is at the 3-listing limit: the button is replaced by the `owner.list.capReached` sky notice.
   - **Delete draft:** inline confirm "Delete this draft and its photos? This can't be undone." with `Delete` (danger) and `Keep it` (secondary, default focus).
   - Arabic wording for take-down is **«سحب الإعلان»**, never «حذف» (except "Delete draft" which truly deletes: «حذف المسودة»).
5. **Enquiries card** (owners only): title `owner.list.enquiries` with a count chip. Each enquiry is a compact row: buyer name (`font-medium`), date (muted, end edge), the message (three lines then "Read more"), then two small 44 px buttons "Call" and "Email" (only those that exist). Status pill via `InquiryStatusPill`. Empty: "No enquiries yet." plus warm line "Once a buyer writes, you'll see it here." (new `owner.list.enquiriesEmptyWarm` / «عندما يكتب لك مشترٍ سيظهر هنا.»). Loading: two skeleton rows. A note at the top in muted text: "You'll only see this here — we don't email you yet." (new `owner.list.noEmailYet` / «ستجد الاستفسارات هنا فقط — لا نرسل لك بريدًا إلكترونيًا بعد.») so nobody waits for an email that does not exist (honest; the spec puts email out of scope).
6. **Edit notice** (only while the listing is live): amber `Notice`, `myListing.form.editNotice` (before the form).
7. **The form** in edit mode (section 3).

### 4.2 Laptop (1440 px)
Two columns inside `max-w-5xl`: **main column (about 680 px) = title, status, edit notice, form; side column (about 300 px, sticky under the header) = cover thumbnail, price, "View as a buyer", the action panel, and (owners) the enquiries card**. The action panel stays in view while the owner edits. The side column is on the **end** edge (right in English, left in Arabic). The take-down panel opens inside the side column. Enquiries card, if long, scrolls inside itself (max height about a screen, scrollbar inside the card).

### 4.3 States
- **Loading:** skeleton of the title (2 bars), pill, hint, the action card (3 button-height bars), and the form skeleton (section 3.8).
- **Not found / not yours:** the standard not-found page, the same for both.
- **Error (action failed):** rose notice directly under the action that failed, using `myListing.errors.*`; buttons re-enable.

---

## 5. Agency "My listings" — `/agency/listings` (B1) stacked cards below 640 px

- **Above 640 px (and laptop 1440):** the table stays (same shell, `max-w-5xl`). Changes: the **title cell is a real link** (teal on hover, underlined), the **whole row is clickable** with a stone-50 hover and a stone-100 pressed fill, a new last column holds a chevron (mirrors in Arabic) as the "this opens" signifier. Status uses `OwnStatusPill`. Columns keep their order; a small cover thumbnail (48 px) is added at the start of the title cell. On laptop, row height about 64 px with the thumbnail.
- **Below 640 px (phone):** a stack of cards, 12 px apart, **no table, no sideways scroll**. Each card is one big link (at least 88 px tall, in practice about 140): 
  1. Row: title (font-medium, two lines then clamp) on the start side; chevron on the end side.
  2. Row: **price** (`text-lg font-bold text-teal-800`) on the reading-end, with "per month" small beside it for rentals; Sale/Rent chip on the other end.
  3. Row: `OwnStatusPill` (full words, not truncated; allowed to wrap to its own line).
  4. Row: property type, muted `text-xs`.
  Pressed state: stone-50 fill. A rejected card adds a one-line "Open to see why." in rose.
- Top area: title, the plan/slots line (free launch: `freeLaunch.allowance`), and "Add a listing". On phone the button is full width under the title; on laptop it sits at the end edge. When the limit truly applies and is reached: replaced by the muted "Limit reached" chip **with** an "Upgrade your plan" link (existing). Hover/long-press hint on the chip: "Free launch is off, so your plan's limit applies." (new `workspace.limitTip`).
- Loading: existing `SkeletonTableRows` above 640 px; below, three card skeletons (title bar, price bar, pill-shaped bar). Empty: existing empty Card with a warm line "No listings yet — your shop window is empty." / «لا توجد إعلانات بعد — واجهة متجرك فارغة.» Error: the same rose notice + Try again as in 1.3.

### Agency listing detail (B2) — `/agency/listings/[id]`
Identical to section 4 **minus the Enquiries card**: same back link, title, pill, hint, rejection block, "View as a buyer", action panel, edit notice, form. Phone: stacked. Laptop: two columns (form left, action panel on the end edge). One added line in the side card for agencies: a link "See enquiries" to `/agency/enquiries` (44 px). The form is the shared `ListingForm` (agency variant: no owner confirmations, no photo minimum; the "Required" tag on photos is absent and the photo box title reads "Photos (optional)" via `myListing.form.photosOptional`, new: EN "Photos (optional) / AR الصور (اختياري)").

---

## 6. Header on a phone (B4)

**Purpose:** reachable, never mis-tapped, Account clearly apart from Sign out.

### 6.1 Phone (390 px)
Two rows (allowed to wrap; nothing overlaps):
- **Row 1:** logo mark + app name (start), and at the end edge the icon controls: theme toggle and language switch, each a 44 x 44 px target (visually small, padded). Row height 56 px.
- **Row 2 (scrollable strip is NOT used; it wraps instead):** the main links "Properties / Market / Calculators" plus role links ("My properties", "Agency", "Admin"), each as a pill-shaped target at least 44 px tall with 12 px horizontal padding and 4 px gap. The active page link is teal with a teal-50 fill (visible selected state). Favourites (a heart + "Favourites") also lives here.
- **Account and Sign out:** in row 1's end group, separated from everything else. Account is a person icon + "Account" text (44 px tall). **Sign out sits in its own group** at the far end, separated by an 8 px gap **and a 1 px vertical divider**, styled as a quiet outlined button with the text "Sign out" (stone ring, rose text on hover/press only, not always red). It is a real button (not a form submit), with a pressed state. Hover/long-press hint "Sign out of this device" / «تسجيل الخروج من هذا الجهاز». Tapping it signs out and shows a small toast "Signed out." («تم تسجيل الخروج.») on the next page.
- Signed out: same two rows; the only right-side control is the filled "Sign in" button (44 px).
- If the screen is too narrow for Account + Sign out + toggles on one row (under about 360 px), the Account/Sign out group moves to row 2's end; never overlapping.

### 6.2 Laptop (1440 px)
Single row, `max-w-6xl` centred: logo at the start, nav links beside it, the controls and Account | Sign out group at the end edge. Hover states on every link (teal). The 44 px padded hit areas stay but are not visible. Account/Sign out separation is the same vertical divider, so the layout matches the phone.

### 6.3 States and reaction
- Active link = teal text + faint teal fill. Pressed = one step darker. Disabled is not used in the header.
- Favourites heart on cards (`FavoriteButton`): 44 x 44 tap area (padding), filled rose when saved; tapping it shows a brief toast "Saved to favourites" / "Removed" (outcome, not just the tap).
- Footer (B4): "List with us / انضم كوكالة" and "List your property / أعلن عن عقارك" as two separate links, 44 px tall, in the same column, with a muted label above the pair ("For sellers" / «للبائعين»: new `footer.forSellers`).

---

## 7. Admin review — `(admin)/admin/review` (A6)

**Purpose:** let the admin check each owner listing harder (first listing) and remove bad photos without leaving the queue.

### 7.1 Card layout (one card per pending listing; reuse the existing review card)
Top row: badges. Badges sit at the start of the row; wrap on phone:
- **"Private owner / مالك فرد"** — stone-100 chip, person icon.
- **"Owner's first listing / أول إعلان لمالك"** — **amber** (warning: look harder), bold weight, flag icon. It is the most noticeable badge on the card. Hover/tap hint: "This seller has never had a listing published. Check it carefully." / «لم يُنشر لهذا البائع أي إعلان من قبل. راجعه بعناية.» (new `admin.review.firstTip`).
- **"Edit of a reviewed listing / تعديل على إعلان سبق مراجعته"** — sky (information).
- **"Phone verified / الهاتف مؤكَّد"** — emerald small chip **next to the seller phone only** (never on the listing; it is an internal fact about the phone, not the property). Hint: "The seller confirmed this number with a code. It does not mean the property is verified." (new `admin.review.phoneTip`).

Then: title, price, neighbourhood and type, **seller block** (name, email, phone; LTR where needed), the description text in both languages (collapsed to 3 lines with "Show all").

**Photos block:** a grid of thumbnails, **3 across on phone, 6 across on laptop**, each with a **"Remove photo"** button under it (the same icon button + text label, 44 px, rose text; text shown under each thumbnail on laptop, icon-only with aria-label and hover hint on phone to save space: no, keep the word on phone too since an unlabelled bin is a mistake risk). Clicking a thumbnail opens it large in the gallery dialog (same as public gallery, section 9.2). Removal is immediate with an inline undo: the tile becomes "Photo removed. Undo" for 6 seconds (then it is final). The admin stays on the queue; the page does not reload. Outcome confirmation: a small green line "Photo removed." If the last photo of an owner listing is removed: amber line under the block "This listing now has no photos. Owners need at least one." (`admin.review.noPhotosLeft`, new).

**Actions row:** primary "Approve", and **Reject** with an optional "Reason (optional, shown to the seller)" text box that appears directly above the Reject button (multi-line, 300 characters, counter). Approve and Reject are separated by the reason box and a divider so they are never adjacent. Loading states on both ("Approving...", "Rejecting..."). Outcome: the card collapses into a one-line confirmation "Approved — it's live now." / "Rejected. The seller will see your reason." and is removed after 4 seconds.

### 7.2 Phone vs laptop
- Phone: one column of cards. Photos 3 across. Actions full width, stacked.
- Laptop: the existing queue width; each card is two columns: left (start) = text details and seller block; right (end) = photo grid (6 across, or 3 x 2 if narrow) and actions. "Owner's first listing" badge stays at the top start of the card on both.

### 7.3 States
- Loading: three card skeletons (badge bars, title bar, a row of photo squares, button bars).
- Empty: "Nothing to review — the queue is clear." with a warm second line "Go and have a karak." (`admin.review.emptyWarm`, EN / AR «لا شيء للمراجعة — اذهب وخذ كوب كرك.»). Owner taste item #2.
- Error: rose notice + Try again.
- Drafts never show.

### 7.4 New strings
| Key | English | Arabic |
|---|---|---|
| `admin.review.firstTip` | This seller has never had a listing published. Check it carefully. | لم يُنشر لهذا البائع أي إعلان من قبل. راجعه بعناية. |
| `admin.review.phoneTip` | The seller confirmed this number with a code. It does not mean the property is verified. | أكّد البائع هذا الرقم برمز. هذا لا يعني أن العقار موثَّق. |
| `admin.review.photoRemoved` | Photo removed. | تم حذف الصورة. |
| `admin.review.undo` | Undo | تراجع |
| `admin.review.noPhotosLeft` | This listing now has no photos. Owners need at least one. | لا توجد صور لهذا الإعلان الآن. يحتاج الملّاك إلى صورة واحدة على الأقل. |
| `admin.review.approved` | Approved — it's live now. | تم الاعتماد — الإعلان منشور الآن. |
| `admin.review.rejected` | Rejected. The seller will see your reason. | تم الرفض. سيرى البائع السبب الذي كتبته. |
| `admin.review.emptyWarm` | Go and have a karak. | اذهب وخذ كوب كرك. |
| `admin.review.showAll` | Show all | عرض الكل |

---

## 8. Admin settings — `/admin/settings` (C1) and the free-launch states (C2)

### 8.1 `/admin/settings`
One narrow column (`max-w-xl`), same on phone and laptop. Title "Site settings", subtitle. One Card for the switch:
- Top row: label "Free launch period" (`font-semibold`) and a state chip at the end: "On" (emerald) or "Off" (stone).
- **The switch control:** a labelled two-state button, not a bare toggle: the current state is written beside it, the button says what tapping will do ("Turn off free launch"). Button is 44 px tall, full width on phone, auto width on laptop. On = ghost/secondary button "Turn off free launch" (quiet, because turning off is the consequential direction); off = primary "Turn on free launch". Hover hint: "This changes what every agency can do, straight away." / «يغيّر هذا ما تستطيع كل وكالة فعله فورًا.» (new `adminSettings.freeLaunch.tip`).
- Under it: the help text for the current state only (`helpOn` or `helpOff`), a divider, and "Last changed {date}" muted.
- **Turning off asks first:** an inline amber confirm panel inside the card (not a pop-up): `confirmOff` text, then `Yes, turn it off` (danger filled) and `Keep it on` (secondary, default focus). Turning **on** needs no confirm.
- Feedback: loading spinner in the button; outcome: green line `adminSettings.saved`, the chip and the help text change at once and "Last changed" updates. Rate limited: rose line `adminSettings.tooMany`.
- Also on this page, read-only info line for the owner cap: "Private owners can have up to 3 live listings. This isn't affected by the switch." (new `adminSettings.ownerCapNote` / «يمكن للملّاك الأفراد نشر 3 إعلانات كحد أقصى. لا يتأثر هذا الحد بالمفتاح.»).
- Loading: skeleton of the card (label bar, button bar, two text bars). Error loading: rose notice + Try again.
- Admin home gets one new card "Site settings" with `adminSettings.dashHint`, same style as the existing admin cards.

### 8.2 `/list-with-us` — "Free during launch" state (C2)
- **Switch ON:** the three price cards and the "manual payment" note disappear. In their place, **one wide Card** (teal-50 tint fill with a teal ring, teal-800 text; a small gift/tag icon in teal): heading "Free during launch / مجاناً خلال فترة الإطلاق" (`text-2xl`), the body `freeLaunch.banner.body`, and under it the existing sign-up button. Below it a **second, smaller Card** for owners: `freeLaunch.ownerCta.title`, body `ownerCta.body` (limit = 3), a secondary button `ownerCta.button` linking to `/account/listings`. On phone the two cards stack (free-launch card first); on laptop, **the free-launch card takes 2/3 of the width and the owner card 1/3, side by side** (the owner card is deliberately secondary and smaller).
- **Switch OFF:** today's page exactly (three price cards, payment note, no owner card).
- Skeleton: the switch is read at page load, so no separate loading state; the page is server-rendered.
- The agency dashboard plan card (C2): plan name reads "Free during launch" with the slots line `freeLaunch.allowance`; a small muted note "Your plan ({tier}) returns when the launch ends." (new `freeLaunch.tierReturns` / «تعود باقتك ({tier}) عند انتهاء فترة الإطلاق.»).

---

## 9. Public property page (A7) — gallery and owner contact

### 9.1 Gallery (inline, on the page)
- **Phone:** the cover photo full width at 4:3 (`object-cover`), with a small counter chip on a gradient strip at the bottom-end corner "1 / 8" (text sits on the gradient, not on the photo). Under it a **horizontal strip of thumbnails** (64 x 64 px, 8 px gap, scrolls sideways with the thumb; that is a photo strip, the one acceptable sideways scroll, marked by the last thumbnail being half-cut). Selected thumbnail has a 2 px teal ring. Tap the big photo or any thumbnail -> the viewer (9.2).
- **Laptop:** one big photo on the start side (about two thirds width) with a 2 x 2 grid of thumbnails on the other third (the fourth tile has a dark-gradient "+N photos" overlay if more exist); below 1024 px it reverts to the phone layout. Clicking any opens the viewer.
- No photos: the existing grey "No photos" block (`properties.noPhotos`) at the same height; no empty strip. Seeded homes keep whatever they show now.
- Loading: the big block as a grey rounded rectangle of the same ratio, plus five grey thumbnails.

### 9.2 Viewer (full screen)
- Opens as a full-screen layer over a dark backdrop (`bg-black/90`); photo centred, `object-contain`. Controls sit over **dark circular chips** (never loose over the photo): close (x) at the top-start corner... **top-end corner in English and top-start in Arabic is avoided: the close button is always at the top-start corner** (mirrors automatically); counter "3 / 8" at the top centre; Next and Previous as 48 px round chips at the vertical middle on each side (**Next on the reading-end side: right in English, left in Arabic; the arrow glyph mirrors with `rtl:rotate-180`**). Thumbnail strip along the bottom.
- Works by: tap/click arrows, swipe (swipe toward the reading-end = next), keyboard (Left/Right arrows swap meaning in Arabic, Escape closes), tap outside the photo closes. Focus is trapped while open and returns to the thumbnail after closing.
- Labels (`properties.gallery.next/previous/close`) are the aria-labels and hover hints on laptop.
- The photo's caption (alt text in the page language, falling back to the title) shows at the bottom on a gradient strip, `text-sm`.
- Loading a photo: a grey square with a spinner until loaded; a photo that fails to load shows a "Photo unavailable / الصورة غير متاحة" block, and Next still works.

### 9.3 Owner contact card (live owner listings with a verified phone)
Reuse `ContactButtons.tsx`. Words: title `enquiry.contactTitle`, line `enquiry.contactViaOwner` ("Listed directly by the owner."), then two buttons side by side, each at least 44 px: **Call** (primary) and **WhatsApp** (secondary), the number beneath in LTR. On phone the two buttons are equal width in one row; on laptop, in the right column card under the price block, same arrangement. Nothing says "verified". Buttons have pressed and focus states as in `Button`. Hover hints: Call "Call the owner on {number}" / «اتصل بالمالك على {number}»; WhatsApp "Open WhatsApp with the owner" / «افتح واتساب مع المالك».
A muted safety line under the buttons (new `enquiry.safetyTip`): EN "Meet at the property and never pay before you've seen it." AR «قابل المالك في العقار ولا تدفع قبل أن تعاين العقار.» Also supports the honest labelling rule (it is user-submitted).
If the owner has no phone on file: nothing is shown (no dead buttons); the existing enquiry form remains.

### 9.4 States
- A property whose only listings are not live: standard not-found page.
- Enquiry form unchanged; its consent line is the updated `enquiry.consent`.

---

## 10. Dark mode and skeleton summary (applies to every screen above)

- Dark colours are the existing pairs: page `stone-950`/body background, Card `stone-900` with `stone-800` ring, skeleton blocks `stone-800`, input background `stone-900` with `stone-700` ring, notices use the dark pairs named under "Notice recipes", status pills use the dark pairs in `StatusPill.tsx`. Thumbnail placeholders `stone-800`; dashed photo box border `stone-700`; selected ring `teal-400`. No shadows are relied on in dark mode; depth is the lighter surface.
- Skeleton per region (all pulse, stop under "reduce motion"): A1 list = two `SkeletonPropertyCard` (one column phone, two laptop); A2 = card with three bars; A4/B2 = title bars + action card + form skeleton; B1 = table rows / three stacked-card skeletons; admin review = three card skeletons with photo squares; admin settings = one card skeleton; gallery = big block + five thumbnails.
- Every region that waits on data (enquiries, photo grid of a saved draft, queue) has its skeleton; nothing shows a blank screen.

## 11. Bilingual and RTL checklist for the builders
- Every string above is a key in both `messages/en.json` and `messages/ar.json` in the same commit, in the owning builder's block (A `owner`/`myListing`/`admin.review`/`enquiry`/`properties.gallery`; B `workspace`/`footer`/`nav`; C `freeLaunch`/`adminSettings`). New keys listed per section above; A adds all `owner.*`, `myListing.*`, `admin.review.*`, `enquiry.safetyTip`; B adds `workspace.limitTip`, `footer.forSellers`, `myListing.form.photosOptional` is A's; C adds `adminSettings.freeLaunch.tip`, `adminSettings.ownerCapNote`, `freeLaunch.tierReturns`.
- Arabic plurals: counts use full Arabic plural forms (see `myListing.form.photosCount`); "1 غرف" is the known bug not to copy.
- Directional glyphs mirrored with `rtl:rotate-180`: back arrow, chevrons in list rows, photo earlier/later, gallery next/previous. Star, bin, heart, flag icons do not mirror.
- Digits: Latin in price, phone, code, counters, dates (app convention). Phone and code wrapped `dir="ltr"`.
- Arabic text in the paired description box is always `dir="rtl"`; English always `dir="ltr"`, in both page languages.
- Hierarchy mirrors: price at the reading-end of its row (right in English, left in Arabic); side column of the listing detail and the action buttons sit on the end edge.

## 12. Reference flows to pull (Mobbin was not reachable, so nothing is cited yet)

I could not call Mobbin, so the brief's "cite each by its mobbin_url" is **not done** and no link is invented. To add the real links later, pull these and record the `mobbin_url` for each under this heading; the decisions above are the ones to check them against, and none may override the app's own styling.

1. **Bayut / Property Finder "add a property" flow** — look at: photo step, cover selection and reordering, per-field error text, draft/"continue where you left off". Compare with section 3.
2. **dubizzle and OpenSooq "post an ad" flow** — look at: photo grid and count limit, how "first photo = cover" is explained, the bilingual Arabic/English form. Compare with 3.2 and the paired-field layout.
3. **Phone OTP / code-entry screens** (a banking or delivery app with Arabic/RTL) — look at: one-box vs six-box code entry, resend countdown wording, wrong/expired code messages. Compare with section 2 (decision: one box).
4. **Airbnb host "create a listing" (photos and listing status/actions)** — look at: photo tile actions, status pill with plain-words hint, take-down/"unlist" confirmation. Compare with 3.2 and 4.

## 13. Owner-taste decisions (only these)
1. **One code box or six boxes** for the phone code (section 2.2). I chose one box (simpler, works with autofill and Arabic). Six boxes look more familiar to some people.
2. **Warm/joking lines:** "Go and have a karak." on the empty admin queue (7.3) and "Your first listing is one phone call away from a buyer." on the empty My properties (1.3). Keep, soften or remove.
3. **The laptop "Before you send" checklist** on the form's side rail (3.7) — a small extra, easy to drop if you want the form plainer.
4. **The safety line** under owner Call/WhatsApp ("Meet at the property and never pay before you've seen it") (9.3) — a small duty-of-care line; say if you would rather not show one.
5. **One design-system addition** proposed: the shared `Notice` component (section 0).

## 14. Builder map (who builds which screen)
- A: sections 1, 2, 3, 4 (owner version), 7, 9, and the `Notice` component.
- B: section 5 (agency list and agency detail wiring to A's pieces), section 6, and the admin market-stats cards.
- C: section 8.

## Mobbin references (pulled by the main session, 30 Sep 2026)

- **Phone code** — [Turo: Verifying phone number](https://mobbin.com/flows/9362954b-8537-4afd-9263-866429c27e3e): a "why we need this" list before starting, then one code field with "Didn't receive the text? Resend code" and the number shown. [Shop: Adding a phone number](https://mobbin.com/flows/5d20e36e-e6c5-4561-b42b-b0385bf6ae86): six boxes, progress dots, "Resend code". [eBay: Listing an item](https://mobbin.com/flows/69a0ee86-f51f-4cf8-8690-d7a467d3ef54): the code check sits inside the listing flow, masked number, "You can resend in 57 seconds" countdown. → Keep the single code box (section 13 choice); add the masked +968 number and a visible resend countdown.
- **Photo box** — [Airbnb: Uploading photos](https://mobbin.com/flows/11086575-f2e6-4943-8d94-476fb86aa6b1), [Airbnb: Adding photos and amenities](https://mobbin.com/flows/094dac13-216b-4792-8bd0-b1ceffb5591d), [Airbnb: Setting cover photo](https://mobbin.com/flows/ed07a96c-3b4f-4a5f-857f-fafe7c4d696a): large empty drop area with one "Add photos" button; upload dialog with per-photo tick; result = big "Cover photo" tile first, then a 2-column grid with a "…" menu per photo (Move backward / Move forward / Make cover photo / Delete) and a dashed "Add more" tile. → Use the per-photo "…" menu instead of drag-only reordering (works on phones and with a keyboard); in Arabic "backward/forward" become "earlier/later" so the words don't depend on direction.
- **Listing summary** — eBay's last step shows "List it for free" with List / Preview / Save for later — matches the free-launch wording and the draft save.
