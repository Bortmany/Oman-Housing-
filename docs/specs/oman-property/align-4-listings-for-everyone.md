# Oman Property Intelligence — Listings for everyone (alignment round, Step 4)

Status: NOT BUILT. Checked 30 Sep 2026 against the `align-2026-10` worktree (read-only; I could not run the app, git or the tests in this session).
Spec for three parallel builders (A, B, C). Folds in the two September specs `listing-photos-and-a-form-that-remembers` and `agency-workspace-on-a-phone` (both confirmed still not built, see "What I checked").

Reads first (for every builder): `AGENTS.md` (Next 16 has breaking changes; docs are in `node_modules/next/dist/docs/`), `docs/CONVENTIONS.md`, `docs/decisions/ads-stats-and-services.md`, and `Agents/docs/engineering-standards.md` §1, §2, §6, §7, §8.

Backlog match: none of the two Oman Property rows in `Agents/docs/backlog.md` is this build (payments decision, email notifications). One is adjacent: **email notifications** — an owner will not be told by email when a buyer writes to them (see Out of scope). The backlog is the owner's file; not edited.

Design note: the plan asks for prior art from Mobbin. **I had no Mobbin access in this session, so no `mobbin_url` is cited.** Comparable flows `ui-designer` should pull before building: Bayut "add a property", dubizzle "post an ad", OpenSooq "post an ad" (all named in `docs/user-testing/research.md` as what Omani sellers already use), plus any phone-code-verification flow. Nothing below claims what those apps do.

---

## 1. The problem, in the owner's words

> "Private owners can't list. Add it, free, with checks against fake listings — phone verification and admin review of the first listing." (owner decision, 30 Sep 2026)

> "Free launch period: unlimited free listings until I switch paid tiers on. Not a data-only launch — listings show from day one."

> "I filled in my villa, pressed Submit for review, and the site logged me out and forgot the whole thing — and there was nowhere to put the photos anyway." (September testing, agency)

> "The one thing an agent opens their phone to check is the thing they cannot see." (September testing — My listings hides price and status off the edge of a phone screen)

Four things ship together:

1. **Private owners can list** (up to 3 live), safely: phone code, every listing reviewed, the first one flagged.
2. **Photos and a form that never loses what you typed**, shared by owners and agencies.
3. **The agency workspace works on a phone**: open, edit, withdraw, mark sold/rented; cards instead of a sideways table; header taps that don't sign you out.
4. **A free-launch switch** in `/admin`: while on, agencies have unlimited listings and prices are hidden.

## 2. What I checked in the code (facts, not assumptions)

- **Agency form has no photos, no file input, no draft.** `(agency)/agency/listings/AgencyListingForm.tsx` has `noValidate`, no file box. Dropdown-reset bug is already fixed in code (`typedOr(...)` from `src/lib/formValues.ts`); the server still returns only the **first** failing field (`parsed.error.issues[0]`).
- **Agency actions have no rate limiter.** `(agency)/agency/actions.ts` never calls `checkRateLimit` and has only three actions: submit, set enquiry status, save profile. No edit / withdraw / sold.
- **My listings is a sideways table** (`w-full min-w-[560px]` inside `overflow-x-auto`) with no link on any row.
- **Tiers:** `src/lib/tiers.ts` — FREE 3 / PREMIUM 25 / BUSINESS unlimited; `listingAllowance(tier, activeCount)` and `canAddListing(tier, activeCount)` are pure; tests in `tiers.test.ts` use a hand-rolled `expectEqual`. Slots in play = `PENDING_REVIEW` + `ACTIVE` (`countListingsInPlay`, `src/lib/db/agencies.ts`).
- **Photo plumbing exists:** `PropertyImage` (path, altEn, altAr, sortOrder, isPrimary), `savePropertyImage` in `src/lib/storage.ts` (5 MB cap, file type read from the file's own first bytes, random name, under `DATA_DIR`), `/api/images/[...path]`. Admin already uploads.
- **Server actions are capped at 1 MB by default** (Next docs, `serverActions.md`) and `next.config.ts` sets no `bodySizeLimit`. A phone photo is 2–5 MB, so photo upload through any action fails today. (I read the docs and config; I did not run it.)
- **A public property page does not check listing status.** `properties/[id]/page.tsx` loads the property by id and shows it (title, description, photos) whatever state its listings are in. Search/cards only show `ACTIVE`, but a `PENDING_REVIEW` owner listing's page would open for anyone who has the address. The public page is keyed on the **property** id, not the listing id.
- **Contact buttons only exist for agencies.** `agencyContactForProperty` needs an approved agency; an owner listing (no agency) shows no Call/WhatsApp today.
- **Buyer enquiries reach only the agency inbox and the admin.** `inquiriesForAgency` filters on `listing.agencyId`. An owner listing has no inbox at all today.
- **`Listing` has no rejection reason.** `rejectListing` only sets `REJECTED`.
- **Privacy page contradicts this feature.** `legal.privacy.shareBody` (both languages) says *"Phone numbers of private individuals are never shown publicly."* `collectEnquiry` and `enquiry.consent` say enquiries go to "the agency". All three become false the moment owners list and must change in the same build.
- **Sign-in landing:** `LoginForm.tsx` defaults to `/account` for everyone. **Header:** Favourites / Account / Sign out are bare text links (no padding); Sign out is a form submit button that sits in the header, before the page's own forms. **Footer:** the link "For agencies" points at `/list-with-us`, and the header's "For agencies" points at `/agency`. **Account page** prints the raw `session.user.role` / `tier` (`AGENCY`, `PREMIUM`) in Arabic.
- **Sign-up gate:** `src/lib/signupMode.ts` — `SIGNUP_INVITE_CODES` set → invite only; production with neither codes nor `SIGNUPS_OPEN` → closed. `registerUser` enforces it. Owners are ordinary registered users (role `USER`), so this gate already covers them.
- **Route protection:** `src/proxy.ts` gates only `/admin` and `/agency`. `/account/*` is only "signed in". Lesson from the earlier pentest (comment in `adminGate.ts`): a layout redirect does **not** stop a page's data query, so every new page needs its guard as its first line (`enforceAdminPage` is the model).
- **Email pattern to copy for SMS:** `src/lib/email/send.ts` — never throws, returns `sent | not-configured | failed`, logs no secrets.
- **Decision file:** `docs/decisions/ads-stats-and-services.md` recommends Twilio Verify for SMS but the owner has **not answered**. This spec stays provider-neutral. One consequence (flagged, not decided): Twilio Verify makes and checks its own codes; this spec has the site make and check its own code (that is what the three `User` fields are for), so it works with any provider that can send an ordinary text message.

## 3. Who builds what — three briefs, no shared files

Merge order for dev-lead: **C → A → B** (each builds in its own worktree and test database against the contracts in §3.4; B rebases on A last). If a builder needs a file it does not own, it stops and asks dev-lead — it does not edit it.

### 3.1 File ownership

| Builder | Owns (may create or edit) |
|---|---|
| **A — private-owner listings + shared form + shared listing rules** | `prisma/schema.prisma` (User fields, `Listing.reviewNote`) + its migration; `src/lib/sms/**`; `src/lib/phoneVerify.ts` (+test); `src/lib/listings/**` (shared rules and actions core, see §3.4) (+tests); `src/components/listing-form/**` (the shared `ListingForm`, photo box, draft memory, status pill, action panel); `src/app/[locale]/(app)/account/listings/**` (new routes); `src/lib/db/listings.ts` (owner contact, public-property rule); `src/lib/db/inquiries.ts` (owner inbox query); `src/components/marketplace/ContactButtons.tsx`; `properties/[id]/page.tsx` (gallery, owner contact, public-property rule); `(admin)/admin/review/page.tsx` + `actions.ts`; `privacy/page.tsx`, `terms/page.tsx` and the `legal.*`, `enquiry.consent`, `enquiry.contactViaOwner` message keys; `next.config.ts` (upload size); `src/app/api/health/route.ts`; `GO-LIVE.md`; `.env.example`; `docs/CONVENTIONS.md` (short additions); `src/lib/storage.ts` tests. |
| **B — agency workspace on a phone + header** | `src/components/layout/{Header,NavLink,LocaleSwitcher,Footer}.tsx`; `src/components/theme/ThemeToggle.tsx`; `src/components/marketplace/FavoriteButton.tsx`; `(auth)/login/LoginForm.tsx`; `(app)/account/page.tsx`; everything under `(agency)/**` (including `agency/actions.ts`, `agency/listings/page.tsx`, `agency/listings/[id]/**`, `agency/listings/new/page.tsx`, `AgencyListingForm.tsx` as a thin wrapper around A's shared form, `agency/profile` rate limit); `(admin)/admin/market-stats/page.tsx` (cards). |
| **C — free-launch switch** | `prisma/schema.prisma` (`SiteSetting` only) + its migration; `src/lib/siteSettings.ts` (+test); `src/lib/tiers.ts` + `tiers.test.ts`; `(admin)/admin/settings/**` (new); `(admin)/admin/page.tsx` (one card); `(public)/list-with-us/page.tsx`; `(agency)/agency/page.tsx` (dashboard plan card only — B does not touch it). |

`messages/en.json` and `messages/ar.json` are edited by all three. To avoid collisions each builder adds **only its own new top-level block at a fixed position** and edits only the existing keys listed for it:

| Builder | New top-level block | Insert it | Existing keys it may edit |
|---|---|---|---|
| A | `owner` and `myListing` | immediately before `"agency"` | `legal.privacy.*`, `legal.terms.listingsBody`, `enquiry.consent`, new keys `enquiry.contactViaOwner`, `admin.review.*` (new keys only) |
| B | `workspace` | immediately before `"errors"` | `nav.*` (new keys), `footer.*` (new keys), `account.*` (new keys) |
| C | `freeLaunch`, `adminSettings` | immediately before `"theme"` | `agency.dashboard.*` (new keys), `agency.signup.pricing.*` (new keys) |

Both language files, same commit, same keys (house rule 3).

### 3.2 Merge order and why
C is small and everyone reads its setting. A next (rules, form, the owner side). B last because it composes A's form and status pieces.

### 3.3 Recommendation: run `ui-designer` first
This is a lot of new screens: owner list, phone-code screen, the shared form with a photo box, listing detail with an action panel, stacked cards, header at 390 px, admin settings. Run `ui-designer` (phone 390 px + laptop, English + Arabic) before A and B start. `Agents/docs/design-standards.md` applies (44 px targets, destructive actions separated, signifiers, overlays), overridden by this repo's conventions. Mobbin flows: see the design note at the top.

### 3.4 Contracts between the builders (names are binding; code is theirs)

- **C exports** `getFreeLaunch()` (reads the switch, default **on**) from `src/lib/siteSettings.ts`, and changes `listingAllowance(tier, activeCount, options?)` / `canAddListing(tier, activeCount, options?)` to take `{ freeLaunch: boolean }` — while true they report **unlimited** whatever the tier. Old two-argument calls keep working (switch treated as off).
- **A exports** from `src/lib/listings/`:
  - `ownsListing(actor, listing)` — the single ownership rule. An **actor** is `{ userId, agencyId | null }`. An agency actor owns listings whose `agencyId` equals theirs. An owner actor (no agency) owns listings where `agencyId` is empty **and** `createdById` is theirs. Nothing else counts. Admin-entered listings (no agency, created by an admin) belong to nobody.
  - the state rules (§5) as pure functions, and the actions core the routes call: save listing, add photo, remove photo, make cover, move photo, submit for review, take off the site (withdraw / sold / rented), send for review again, delete draft.
  - `ListingForm` (client), `ListingActionsPanel`, `OwnStatusPill`, and the per-audience wiring point: the form receives its **actions as props**, so the owner routes (A) and the agency routes (B) each pass their own thin server actions that call the same core.
- **B** passes agency-flavoured actions (rate limits keyed `agency:`) and mounts A's form, panel and pill. B never re-implements a rule.

## 4. Screens

Everywhere: phone = 390 px wide, laptop = 1440 px wide. Every tap target at least 44 px. Errors sit under the box that caused them and name it. Spacing/alignment use logical properties only (`ms-/me-/ps-/pe-/text-start`); the only `rtl:` uses are glyph mirroring and Arabic type size (house rule 4). Money through `formatOMRWhole`, Latin digits in Arabic. Links and redirects through `src/i18n/navigation.ts` (house rule 5).

### 4.1 Builder A — private owners

Owner = any signed-in user with role `USER` and no agency. **No new role.** Agencies who open owner pages are sent to `/agency`; admins to `/admin`; signed-out visitors to `/login` (with a way back).

**A1. My properties — `/[locale]/account/listings`**
- Title "My properties". One-line lede. "Add a property" button (full width on phone, right-aligned on laptop).
- If the phone is not verified yet: a card "Verify your phone to start" with a button to A2 instead of the Add button.
- Cap line: "{used} of {limit} live or in-review listings used." When 3 of 3: the Add button is replaced by the cap message (never a dead button).
- Each listing is a card: cover photo (or an honest "No photos yet" block), title in the page language, price (with "per month/per year" for rentals), status pill with the plain-words hint underneath, and "Open". Drafts show "Continue". **Phone:** one column, no sideways scroll. **Laptop:** two columns.
- After sending for review the page shows a green notice (`owner.list.submittedNotice`).
- Empty state: `owner.list.empty` + `owner.list.emptyHint`.

**A2. Verify your phone — `/[locale]/account/listings/verify-phone`**
1. Box for an **Omani mobile number** (country code fixed to +968, shown as text; digits validated with the existing `checkPhone("+968", …)`: 8 digits starting 7 or 9). Button "Send code".
2. The site makes a **6-digit code**, stores only a scrambled copy (a keyed hash that also covers the user and the number, so a code can't be used for a different number), valid **10 minutes**, and sends it as a text through `src/lib/sms/send.ts`.
3. Second step on the same screen: "6-digit code" box (numeric keypad on phones, `autocomplete="one-time-code"`), "Confirm", "Send a new code" (60-second wait, with a live "in N seconds" line), "Use a different number".
4. On success `phoneVerifiedAt` is set, the code fields are cleared, and the owner lands on the Add form.
- **Rules:** only +968 mobiles; one verified number belongs to **one account** ("already verified on another account"); 5 wrong codes voids the current code; changing the number clears `phoneVerifiedAt`.
- **No provider keys (dormant):** in development the code is written to the server log (development only, never in production). In production the screen shows `owner.verify.notAvailable` and owner listing stays closed (fail closed, same idea as `signupMode` "closed"). Nothing throws.
- Phone: single column, the code box and buttons ≥44 px, no layout jump between steps. Laptop: same, centred narrow column.

**A3. Add a property — `/[locale]/account/listings/new`**
Needs a verified phone and a free slot (else redirected to A2 or shown the cap message). Shows the shared form (A5) for owners, plus two required tick-boxes and one line of notice:
- Tick 1: "I confirm I own this property or have the owner's permission to list it."
- Tick 2: "Show my verified phone number (+968 …) on this listing so buyers can call or WhatsApp me."
- Notice: "Every listing is checked by our team before it appears publicly. Your first listing may take a little longer."

**A4. One listing — `/[locale]/account/listings/[id]`**
Back arrow (mirrors in Arabic via `DirectionalLink`), title, status pill + hint, the review note if it was rejected (`myListing.rejectedReason` or the no-reason line), "View as a buyer" when live (goes to `/properties/<propertyId>`), the shared action panel (§4.3), an **Enquiries** card (read-only list of buyer name, email, phone, message, date, status pill — only enquiries on this listing), then the shared form in edit mode with a saving notice: "Your changes go back for review before they appear publicly." (shown only while the listing is live).
- `id` is a listing id. If it does not exist **or is not this owner's**, show the same standard not-found page — the two cases must be indistinguishable.

**A5. The shared listing form (used by owners and agencies) — `src/components/listing-form/`**
- Photos first: "Choose photos" (many at once), a thumbnail for each with **Cover** label, "Make cover", "Move earlier", "Move later" (buttons, not drag-only, so it works with a thumb and mirrors correctly in RTL), "Remove photo", and a collapsed "Describe this photo" with two optional boxes (English, Arabic) that default to the listing title. Hint under the box: how many photos (max **15**), size (max **5 MB** each, JPEG/PNG/WebP), that the first is the cover, that photos are reviewed with the listing, and the rights line ("Only upload photos you have the right to publish. No faces, car number plates or documents.").
- Photos are uploaded **one per request** (each ≤5 MB), after the text is saved as a **draft** (`DRAFT` status: never counted against the cap, never public, never in the review queue). This is what makes per-file errors possible and keeps every request under a 6 MB limit. Sequence on "Submit for review": validate in the browser → save text (creates the draft or updates it) → upload new photos one by one ("Uploading 2 of 3…") → send for review. A photo that fails is named with the reason next to the photo box; the listing stays a draft and the owner can remove or retry that photo and press Submit again (already-uploaded photos are not sent twice).
- Every dropdown returns as chosen; every failing box is named (the server returns **all** failing fields, not only the first); an empty submit is stopped in the browser (own messages, in the page language, focus jumps to the first empty required box); the server re-checks everything.
- **A stray refresh keeps the typed text:** the browser keeps a draft (only in that browser, never on the server) of all text boxes, **both the English and Arabic side of every paired box**. On return: "We kept what you typed. Restore it?" with **Restore** / **Start fresh**, plus "Photos you chose aren't kept — add them again." Cleared once the listing is sent. Photos already uploaded to the saved draft stay.
- Fields: neighbourhood, type, ownership (default "Ownership not confirmed"), title EN/AR, description EN/AR, bedrooms, bathrooms, built area, year built, sale/rent, price (OMR), rent period. Reuse the existing labels (`admin.property.*`, `admin.listing.*`, `admin.examples.*`). Provenance, confidence, status, agency and owner are **never read from the form** (§6).
- Owners must attach **at least 1 photo** to send for review; agencies have no minimum.
- Phone: one column, labels above boxes, photo thumbnails in a 2-up grid, Submit button full width and always reachable. Laptop: two columns for paired fields as today.

**A6. Admin review queue — `(admin)/admin/review`**
Each pending card gets: a badge **"Private owner"** for owner listings and **"Owner's first listing"** when it is that owner's first ever (no earlier listing of theirs has been published); a badge **"Edit of a reviewed listing"** when it was published before and has come back; the seller's name, email and phone (with "Phone verified" for owners); thumbnails of the submitted photos with a per-photo **Remove photo** button that keeps the admin on the queue; and next to Reject an optional short **reason** box that is shown to the seller. Draft listings never appear in the queue, and their properties are left out of the "unverified properties" list.

**A7. Public listing page — `properties/[id]`**
- **Gallery:** cover large; thumbnails below; tap a thumbnail to see it large with next / previous / close. Next/previous swap sides in Arabic (arrow glyphs mirrored the sanctioned way, `rtl:rotate-180`); keyboard and swipe work; labels are translated.
- **Owner contact:** for a live owner listing whose owner has a verified phone, the existing Call / WhatsApp card appears with "Listed by the owner." and the verified number. Nothing on any public page says "verified" about an owner or their listing (the listing is still the site's "user-submitted" label).
- **Public-property rule:** the page opens only if the property has **no listings at all** (admin reference records, as today) or has **at least one live listing**. Otherwise it is the standard not-found page. This stops pending, rejected, withdrawn and sold listings being readable by anyone holding the address.

### 4.2 Builder B — agency workspace on a phone

**B1. Agency My listings — `(agency)/agency/listings`**
- Every row **opens its listing**. Above 640 px: the table as today, with the title a real link (whole row clickable, hover/press feedback). **Below 640 px each listing is a stacked card:** title, then price (with the "per month" tag for rentals), then the status pill (`OwnStatusPill`), then the type — all readable with **no sideways scroll**, in English and Arabic. Whole card is the link (≥44 px).
- The plan / slots line stays. It now reads the free-launch switch (contract §3.4): while on it says `freeLaunch.allowance`; when off, today's wording. The "Add a listing" button is disabled with the message only when the limit truly applies.

**B2. One listing — `(agency)/agency/listings/[id]`** (new)
Same layout as A4 without the enquiries card (agencies already have `/agency/enquiries`): back arrow (mirrors), title, status + hint, rejection reason, "View as a buyer" when live, A's action panel, A's form in edit mode, the "changes go back for review" notice. Someone else's or a missing id → identical standard not-found page. Loaded with a query that filters on the agency itself (`where id AND agencyId`), never "load then check".

**B3. Admin market statistics — `(admin)/admin/market-stats`**
Below 640 px each row is a card showing area, type, period, price, rent, yield and the source badge, with **"Delete this figure"** as a separate rose-coloured text button at the bottom behind a divider (≥44 px, never next to another control). Above 640 px unchanged.

**B4. Header, footer, sign-in, account page**
- Header: every control (main nav links, Favourites, Account, Sign out, theme toggle, language switch, the favourites heart on cards and pages) has a tap area ≥44×44 px on a phone, using padding, visually calm. **Sign out is separated from Account** (its own group with a visible divider and at least 8 px gap) and is a plain button that signs out, **not a form submit button**, so nothing in the header is the page's first submit button. Signed-in `USER` role sees "My properties" in the nav. Header at 390 px may wrap to two rows; nothing may overlap.
- Footer: "For agencies" link becomes **"List with us"** (`footer.listWithUs`) and still goes to `/list-with-us`; a second link **"List your property"** goes to `/account/listings`. The header's "For agencies" keeps pointing at `/agency`.
- Sign-in: when the visitor did not arrive with a `callbackUrl`, an **agency lands on `/agency`**, an **admin on `/admin`**, anyone else on `/account`. Arabic stays Arabic (redirect through `src/i18n/navigation.ts`).
- Account page: shows role and plan through translations (no raw `AGENCY`/`PREMIUM`); adds a card that depends on role — agency: "Your agency workspace", admin: "Admin desk", user: "List your property" (links to `/account/listings`).
- Agency profile save gets a rate limit (§7).

### 4.3 Shared action panel (built by A, mounted by A and B)
On the listing page: **Edit** (scrolls to the form), **Take it off the site** (opens an inline panel or dialog with three choices — "It's been sold" only for sale listings, "It's been rented" only for rent listings, "Just withdraw it for now" — a plain-words consequence line and Confirm / Keep it live), **Send for review again** (for rejected / withdrawn / sold / rented), **Delete draft** (only for drafts, with confirm). Destructive controls are visually separated. Arabic withdraw wording is **"سحب الإعلان"**, never "حذف" (nothing is deleted; enquiries survive).

### 4.4 Builder C — free-launch switch

**C1. `/[locale]/admin/settings`** (new, admin only, guard first)
One switch: **Free launch period**. Shows current state, what each state does, when it was last changed. Turning it **off** asks a confirm first (agencies over their limit will be unable to add). One button (≥44 px), phone and laptop the same narrow column. New card on the admin home ("Site settings").

**C2. Where the switch shows**
- `/list-with-us`: while **on**, the three price cards and the "manual payment" note are hidden and replaced by one card "Free during launch / مجاناً خلال فترة الإطلاق"; a second small card for owners ("Selling or renting your own home?") with a button to `/account/listings`. While **off**, today's page exactly.
- Agency dashboard plan card: while on, plan reads "Free during launch" and the slots line says there is no limit. The stored tier is untouched and comes back when the switch goes off.
- Behaviour: while on, `listingAllowance` is unlimited for every tier, including for the check inside A's submit action. Off: FREE 3 / PREMIUM 25 / BUSINESS unlimited again; anything already live stays live; only new ones are refused. **The switch does not change the private-owner cap of 3.**
- Default when there is no saved row: **on**.

## 5. Rules (what may happen to a listing) — the pure functions A writes and tests

**Owner cap:** at most **3** listings `PENDING_REVIEW` + `ACTIVE` at once per owner (`createdById` = that user, no agency), checked when a listing is sent for review or sent again. The check runs inside one database transaction that first locks the owner's user row, so two simultaneous clicks cannot both pass. At most **3 unfinished drafts** per owner (10 per agency).

**Every owner listing goes to `PENDING_REVIEW`. None is ever auto-published.** The "Owner's first listing" flag is worked out, not stored: the owner has no listing with a `publishedAt`.

| From | To | Who / when |
|---|---|---|
| (new) | `DRAFT` | first save of the form |
| `DRAFT` | `PENDING_REVIEW` | Submit for review (owners: needs ≥1 photo, a verified phone, both tick-boxes, a free slot) |
| `PENDING_REVIEW` | `ARCHIVED` | Withdraw |
| `ACTIVE` | `ARCHIVED` / `SOLD` / `RENTED` | Take it off the site (`SOLD` only for sale, `RENTED` only for rent) |
| `REJECTED`, `ARCHIVED`, `SOLD`, `RENTED` | `PENDING_REVIEW` | Send for review again (slot check applies; clears the old review note) |
| `ACTIVE` | `PENDING_REVIEW` | any **content change**: text, price, type, ownership, a photo **added** |
| `PENDING_REVIEW` → ACTIVE, → REJECTED | admin only | existing admin approve / reject |

Removing a photo, changing the cover or reordering photos does not send a live listing back to review (nothing unreviewed can enter). Saving with **no** change leaves a live listing live. An edited listing keeps its old `publishedAt`, which is how the admin sees "Edit of a reviewed listing". Withdrawn = `ARCHIVED`; in the seller's own screens that reads "Withdrawn" (`myListing.status.ARCHIVED`), in the admin it stays "Archived".

## 6. Security and isolation

1. **One ownership rule** (`ownsListing`, §3.4), used by every action and every page. Every photo action checks that the photo belongs to a listing the actor owns — never an image id on its own.
2. **Never trust the browser** for `status`, `agencyId`, `createdById`, `provenance`, `confidence`, `publishedAt`, `isPrimary`, `sortOrder`, `phoneVerifiedAt`. All set server-side. Owner listings are always `USER_SUBMITTED`, confidence 0.5, source note "Submitted by a private owner". **Never `VERIFIED`** (house rule 1).
3. **Guard first on every page.** Each new page calls its guard as its first line, before any query (owner pages: signed in, role `USER`, no agency; agency pages: role `AGENCY` with an agency; settings page: `enforceAdminPage`). Every new action re-checks role and ownership itself (house rule 7).
4. **Not-yours and missing look the same** (standard not-found), so ids cannot be probed.
5. **Owners see only their own enquiries** (`listing.agencyId` empty and `listing.createdById` = them).
6. **Uploads:** reuse `savePropertyImage` exactly (type read from the bytes, 5 MB, random name, under `DATA_DIR`). No second upload route, no browser-only check. If saving the database row fails after the file is written, delete the file. Add a photo count check (max 15) on the server.
7. **Phone codes:** made with a cryptographic random generator; only a keyed hash is stored (key = `AUTH_SECRET`, input includes user id and number); compared in constant time; the code is never logged except the development-only dev log; the code is cleared on success, expiry or after 5 wrong tries.
8. **SMS cost/abuse:** limits in §7; Omani mobile numbers only (blocks sending to foreign premium numbers); signed-in only; the sign-up invite gate sits in front of account creation.
9. **The server-action size limit** is raised in `next.config.ts` to **6 MB** (one photo + form overhead), not to a large value. Note: that also lifts the current 1 MB ceiling on the admin's multi-photo form (checked in docs, not run).
10. **Residual, stated not fixed:** photos are served by `/api/images/...` from a hard-to-guess random address to anyone who has it, including photos of a pending listing. Making unpublished photos private is out of scope. Reviewer to also check that the AI analyst (`src/lib/ai/analyst.ts`) cannot be pointed at a not-yet-public property id; if it can, add the same public-property rule at its entry without touching its leash logic, and run `analystCore.test.ts`.

## 7. Rate limits (`checkRateLimit`, `src/lib/rate-limit.ts`; per signed-in user id; in-memory per process, `REDIS_URL` seam still not wired — accepted, unchanged)

| Action | Limit | Key |
|---|---|---|
| Send a phone code | 3 per hour per user **and** 3 per hour per phone number; one every 60 s | `owner:sms:send:user:<id>`, `owner:sms:send:phone:<digits>`, cooldown |
| Check a phone code | 5 wrong per 10 minutes (5th voids the code) | `owner:sms:check:user:<id>` |
| Save / submit listing (owner and agency) | 20 per hour | `listing:save:user:<id>` |
| Upload a photo | 60 files per hour | `listing:photo:user:<id>` |
| Edit content / take off / resend | 30 per hour | `listing:change:user:<id>` |
| Agency profile save | 20 per hour | `agency:profile:user:<id>` |
| Toggle free launch | same per-admin limiter as the other admin actions (120/min) | `admin:user:<id>` |

Refusals: plain words in both languages, in the form's own message slot — never a dead button (`myListing.errors.rateLimited`).

## 8. The data touched, in plain terms

- **A private owner's mobile number is now stored** (in the existing phone field) together with **the time it was verified** and, for at most ten minutes, a scrambled copy of the current code and its expiry.
- **That number is shown publicly** on that owner's live listings (Call / WhatsApp), and the number is processed by whichever SMS provider the owner chooses.
- **Buyers' enquiry details** (name, email, phone, message) on an owner's listing are now shown to that owner.
- **Each listing gets photos** (files on the server's storage disk; the listing remembers which files, which is the cover, the order, and an optional description in English and Arabic — the tables for this already exist). **Each listing can carry a short note** from the admin explaining a rejection.
- **A new small settings table** holds the free-launch switch.
- **Nothing is removed or renamed.** Additive database changes only, as real migration files (house rule 11; never `db push`):
  1. A: `User.phoneVerifiedAt` (optional date), `User.phoneVerifyCodeHash` (optional text), `User.phoneVerifyExpiresAt` (optional date); `Listing.reviewNote` (optional text). Migration name e.g. `add_owner_phone_verification_and_review_note`.
  2. C: table `SiteSetting` (`key` text primary key, `value` text, `updatedAt`). Migration name e.g. `add_site_settings`. Seed: none needed (a missing row means "free launch on").
- Everything else (status values, provenance, `PropertyImage`, `Inquiry`) already exists. `agencyId` empty on a listing is how an owner listing is recognised; no new role.
- **Photos live on the `/data` volume, a single copy not covered by database backups.** `GO-LIVE.md` already says the volume must be mounted; A extends it with the plain-English copy-out step and notes owners' photos.

## 9. Bilingual note

Everything ships in `messages/en.json` and `messages/ar.json` in the same commit. Counts use proper Arabic plural rules (the app currently gets "1 غرف" wrong — do not copy that). Phone numbers, codes and money render with **Latin digits** in Arabic; wrap them `dir="ltr"`. Numbers passed into sentences: check how the existing slots line renders digits in `/ar` and match the app's convention (do not introduce Arabic-Indic digits in money or codes). The text message is sent in the user's saved `locale`. Arabic wording for withdraw is "سحب الإعلان" (never "حذف"). Every status goes through translations — no raw `PENDING_REVIEW`, `AGENCY` or `PREMIUM` ever shown.

### 9.1 Strings — A: `owner` (owner-only)

| Key | English | Arabic |
|---|---|---|
| `owner.title` | My properties | عقاراتي |
| `owner.lede` | List your own home for sale or rent, free. Every listing is checked by our team before it appears publicly. | أعلن عن عقارك للبيع أو الإيجار مجانًا. يراجع فريقنا كل إعلان قبل ظهوره للعموم. |
| `owner.newListing` | Add a property | إضافة عقار |
| `owner.list.capLine` | {used} of {limit} live or in-review listings used. | استُخدم {used} من {limit} إعلانات منشورة أو قيد المراجعة. |
| `owner.list.capReached` | You've reached the limit of {limit} live listings. Withdraw one, or mark it as sold or rented, to add another. | بلغتَ الحد الأقصى وهو {limit} إعلانات نشطة. اسحب أحد إعلاناتك أو حدّده كمباع أو مؤجَّر لإضافة إعلان آخر. |
| `owner.list.empty` | You haven't listed a property yet. | لم تُضف أي عقار بعد. |
| `owner.list.emptyHint` | Add your first property. It's free, and we check it before it goes public. | أضف عقارك الأول. الخدمة مجانية، ونراجع الإعلان قبل نشره للعموم. |
| `owner.list.submittedNotice` | Thanks — your listing is with our team. We'll review it before it appears publicly. | شكرًا — إعلانك لدى فريقنا. سنراجعه قبل ظهوره للعموم. |
| `owner.list.continue` | Continue | متابعة |
| `owner.list.open` | Open | فتح |
| `owner.list.needsPhone` | Verify your phone to start | أكّد رقم هاتفك للبدء |
| `owner.list.enquiries` | Enquiries about this listing | الاستفسارات عن هذا الإعلان |
| `owner.list.enquiriesEmpty` | No enquiries yet. | لا توجد استفسارات بعد. |
| `owner.verify.title` | Verify your phone number | تأكيد رقم هاتفك |
| `owner.verify.why` | Buyers will contact you on this number, and we use it to keep fake listings out. We send one text message with a 6-digit code. | سيتواصل معك المشترون على هذا الرقم، ونستخدمه لمنع الإعلانات الوهمية. سنرسل رسالة نصية واحدة تحتوي على رمز من 6 أرقام. |
| `owner.verify.phoneLabel` | Omani mobile number | رقم الجوال العُماني |
| `owner.verify.phoneHint` | Oman numbers only: 8 digits starting with 9 or 7. | أرقام سلطنة عُمان فقط: 8 أرقام تبدأ بـ 9 أو 7. |
| `owner.verify.sendCode` | Send code | إرسال الرمز |
| `owner.verify.codeSent` | We sent a code to {phone}. It works for 10 minutes. | أرسلنا رمزًا إلى {phone}. يبقى صالحًا لمدة 10 دقائق. |
| `owner.verify.codeLabel` | 6-digit code | الرمز المكوّن من 6 أرقام |
| `owner.verify.confirm` | Confirm | تأكيد |
| `owner.verify.resend` | Send a new code | إرسال رمز جديد |
| `owner.verify.resendWait` | You can ask for a new code in {seconds} seconds. | يمكنك طلب رمز جديد بعد {seconds} ثانية. |
| `owner.verify.changeNumber` | Use a different number | استخدام رقم آخر |
| `owner.verify.done` | Phone verified. You can now add your property. | تم تأكيد رقمك. يمكنك الآن إضافة عقارك. |
| `owner.verify.errors.wrongCode` | That code isn't right. Check the message and try again. | الرمز غير صحيح. راجع الرسالة وحاول مرة أخرى. |
| `owner.verify.errors.expired` | That code has expired. Ask for a new one. | انتهت صلاحية الرمز. اطلب رمزًا جديدًا. |
| `owner.verify.errors.tooManyTries` | Too many wrong codes. Ask for a new code. | أدخلت رموزًا خاطئة كثيرة. اطلب رمزًا جديدًا. |
| `owner.verify.errors.rateLimited` | Too many codes requested. Please wait an hour and try again. | طلبتَ رموزًا كثيرة. يرجى الانتظار ساعة ثم المحاولة مجددًا. |
| `owner.verify.errors.invalidPhone` | Enter an Omani mobile number: 8 digits starting with 9 or 7. | أدخل رقم جوال عُماني مكوّنًا من 8 أرقام يبدأ بـ 9 أو 7. |
| `owner.verify.errors.phoneInUse` | This number is already verified on another account. | هذا الرقم مؤكَّد بالفعل في حساب آخر. |
| `owner.verify.errors.sendFailed` | We couldn't send the text message. Please try again in a few minutes. | تعذّر إرسال الرسالة النصية. يرجى المحاولة بعد دقائق. |
| `owner.verify.notAvailable` | Phone verification isn't switched on yet, so owner listings are not open. Please check back soon. | خدمة تأكيد الهاتف غير مفعّلة بعد، لذا إعلانات الملّاك غير متاحة حاليًا. يرجى العودة لاحقًا. |
| `owner.form.ownerConfirm` | I confirm I own this property or have the owner's permission to list it. | أؤكد أنني مالك هذا العقار أو لدي إذن المالك بإدراجه. |
| `owner.form.phoneConsent` | Show my verified phone number ({phone}) on this listing so buyers can call or WhatsApp me. | عرض رقم هاتفي المؤكَّد ({phone}) على هذا الإعلان ليتمكن المشترون من الاتصال بي أو مراسلتي عبر واتساب. |
| `owner.form.tickRequired` | Tick this box to continue. | ضع علامة في هذا المربع للمتابعة. |
| `owner.form.reviewNotice` | Every listing is checked by our team before it appears publicly. Your first listing may take a little longer. | يراجع فريقنا كل إعلان قبل ظهوره للعموم. قد يستغرق إعلانك الأول وقتًا أطول قليلًا. |
| `owner.sms.body` | {appName}: your code is {code}. It expires in 10 minutes. Never share it. | {appName}: رمزك هو {code}. ينتهي خلال 10 دقائق. لا تشاركه مع أحد. |

(`{appName}` = `common.appName` in the recipient's language: "Oman Property Intelligence" / "ذكاء العقارات عُمان".)

### 9.2 Strings — A: `myListing` (shared by owner and agency screens; B uses these verbatim)

| Key | English | Arabic |
|---|---|---|
| `myListing.status.DRAFT` | Draft — not sent yet | مسودة — لم تُرسل بعد |
| `myListing.status.PENDING_REVIEW` | In review | قيد المراجعة |
| `myListing.status.PENDING_REVIEW_EDIT` | Changes in review | التعديلات قيد المراجعة |
| `myListing.status.ACTIVE` | Live | منشور |
| `myListing.status.REJECTED` | Not approved | لم يُعتمد |
| `myListing.status.SOLD` | Sold | مباع |
| `myListing.status.RENTED` | Rented | مؤجَّر |
| `myListing.status.ARCHIVED` | Withdrawn | مسحوب |
| `myListing.hint.DRAFT` | Finish the form and send it for review. | أكمل النموذج ثم أرسله للمراجعة. |
| `myListing.hint.PENDING_REVIEW` | Our team is checking it. It isn't public yet. | يراجعه فريقنا الآن. لم يظهر للعموم بعد. |
| `myListing.hint.PENDING_REVIEW_EDIT` | Your changes are being checked. The listing is hidden until they're approved. | نراجع تعديلاتك. يبقى الإعلان مخفيًا حتى تُعتمد. |
| `myListing.hint.ACTIVE` | Visible to everyone on the site. | ظاهر للجميع على الموقع. |
| `myListing.hint.REJECTED` | It was not approved. Fix anything that looks wrong and send it for review again. | لم يُعتمد الإعلان. صحّح ما يلزم ثم أرسله للمراجعة مرة أخرى. |
| `myListing.hint.SOLD` | Marked as sold. Not shown publicly. | حُدّد كمباع. لا يظهر للعموم. |
| `myListing.hint.RENTED` | Marked as rented. Not shown publicly. | حُدّد كمؤجَّر. لا يظهر للعموم. |
| `myListing.hint.ARCHIVED` | Withdrawn. Not shown publicly. You can send it for review again. | مسحوب. لا يظهر للعموم. يمكنك إرساله للمراجعة مرة أخرى. |
| `myListing.rejectedReason` | Why it wasn't approved: {reason} | سبب عدم الاعتماد: {reason} |
| `myListing.edit` | Edit | تعديل |
| `myListing.viewAsBuyer` | View as a buyer | عرض كما يراه المشتري |
| `myListing.back` | Back to my listings | العودة إلى إعلاناتي |
| `myListing.takeDown` | Take it off the site | إزالته من الموقع |
| `myListing.takeDownTitle` | Take this listing off the site? | هل تريد إزالة هذا الإعلان من الموقع؟ |
| `myListing.reasonSold` | It's been sold | تم بيعه |
| `myListing.reasonRented` | It's been rented | تم تأجيره |
| `myListing.reasonWithdrawn` | Just withdraw it for now | سحبه مؤقتًا فقط |
| `myListing.withdrawBody` | It will no longer appear publicly. The listing and its enquiries are kept, and you can send it for review again later. | لن يظهر للعموم بعد الآن. يبقى الإعلان واستفساراته محفوظين، ويمكنك إرساله للمراجعة مرة أخرى لاحقًا. |
| `myListing.soldBody` | It will be taken off the public site and marked as sold in your list. | سيُزال من الموقع العام ويُسجَّل كمباع في قائمتك. |
| `myListing.rentedBody` | It will be taken off the public site and marked as rented in your list. | سيُزال من الموقع العام ويُسجَّل كمؤجَّر في قائمتك. |
| `myListing.confirm` | Confirm | تأكيد |
| `myListing.keepLive` | Keep it live | إبقاؤه منشورًا |
| `myListing.resubmit` | Send for review again | إرسال للمراجعة مرة أخرى |
| `myListing.resubmitBody` | Your listing goes back to our team before it appears publicly. | يعود إعلانك إلى فريقنا قبل ظهوره للعموم. |
| `myListing.deleteDraft` | Delete draft | حذف المسودة |
| `myListing.deleteDraftConfirm` | Delete this draft and its photos? This can't be undone. | هل تريد حذف هذه المسودة وصورها؟ لا يمكن التراجع عن ذلك. |
| `myListing.saved` | Changes saved. | تم حفظ التعديلات. |
| `myListing.errors.notAllowed` | You don't have permission to do that. | ليست لديك صلاحية للقيام بذلك. |
| `myListing.errors.rateLimited` | You've done that a lot in the last hour. Please try again a bit later. | قمتَ بذلك مرات كثيرة خلال الساعة الماضية. يرجى المحاولة لاحقًا. |
| `myListing.errors.wrongState` | This listing can't be changed that way right now. Refresh the page and try again. | لا يمكن تغيير هذا الإعلان بهذه الطريقة حاليًا. حدّث الصفحة وحاول مرة أخرى. |
| `myListing.errors.draftLimit` | You already have {count, plural, one {# unfinished draft} other {# unfinished drafts}}. Finish or delete one first. | لديك بالفعل {count, plural, one {مسودة واحدة غير مكتملة} two {مسودتان غير مكتملتين} few {# مسودات غير مكتملة} many {# مسودة غير مكتملة} other {# مسودة غير مكتملة}}. أكمل إحداها أو احذفها أولًا. |
| `myListing.errors.summary` | Please fix the highlighted boxes and try again. | يرجى تصحيح الحقول المظلَّلة والمحاولة مرة أخرى. |
| `myListing.errors.required` | This box is required. | هذا الحقل مطلوب. |
| `myListing.errors.pricePositive` | The price must be more than zero. | يجب أن يكون السعر أكبر من صفر. |
| `myListing.errors.number` | Enter a number. | أدخل رقمًا. |
| `myListing.errors.yearRange` | Enter a year between 1900 and 2100. | أدخل سنة بين 1900 و2100. |
| `myListing.errors.tooLong` | This is too long (maximum {max} characters). | النص طويل جدًا (الحد الأقصى {max} حرفًا). |
| `myListing.form.photosTitle` | Photos | الصور |
| `myListing.form.photosHint` | Add up to {max} photos, {size} MB each (JPEG, PNG or WebP). The first photo is the cover. Photos are reviewed with the listing before anything goes public. | أضف حتى {max} صورة، بحجم أقصاه {size} ميغابايت للصورة (JPEG أو PNG أو WebP). الصورة الأولى هي صورة الغلاف. تُراجَع الصور مع الإعلان قبل نشر أي شيء للعموم. |
| `myListing.form.photosRights` | Only upload photos you have the right to publish. Don't include people's faces, car number plates or documents. | ارفع فقط صورًا لديك الحق في نشرها. لا تُدرج وجوه أشخاص أو لوحات سيارات أو مستندات. |
| `myListing.form.photosAdd` | Choose photos | اختيار الصور |
| `myListing.form.photosCount` | {count, plural, =0 {No photos yet} one {# photo} other {# photos}} | {count, plural, =0 {لا توجد صور بعد} one {صورة واحدة} two {صورتان} few {# صور} many {# صورة} other {# صورة}} |
| `myListing.form.photoCover` | Cover | الغلاف |
| `myListing.form.photoMakeCover` | Make cover | اجعلها الغلاف |
| `myListing.form.photoRemove` | Remove photo | حذف الصورة |
| `myListing.form.photoEarlier` | Move earlier | تقديم |
| `myListing.form.photoLater` | Move later | تأخير |
| `myListing.form.photoDescribe` | Describe this photo (optional) | صف هذه الصورة (اختياري) |
| `myListing.form.photoAltEn` | Description (English) | الوصف (بالإنجليزية) |
| `myListing.form.photoAltAr` | Description (Arabic) | الوصف (بالعربية) |
| `myListing.form.photoAltHint` | Read aloud to people using screen readers. Leave empty to use the listing title. | تُقرأ بصوت عالٍ للمستخدمين الذين يستعينون بقارئ الشاشة. اتركها فارغة لاستخدام عنوان الإعلان. |
| `myListing.form.photoUploading` | Uploading {current} of {total}… | جارٍ رفع {current} من {total}… |
| `myListing.form.photoErrorSize` | “{name}” is larger than {size} MB. | الملف «{name}» أكبر من {size} ميغابايت. |
| `myListing.form.photoErrorType` | “{name}” isn't a JPEG, PNG or WebP photo. | الملف «{name}» ليس صورة بصيغة JPEG أو PNG أو WebP. |
| `myListing.form.photoErrorLimit` | You can add up to {max} photos. | يمكنك إضافة {max} صورة كحد أقصى. |
| `myListing.form.photoErrorFailed` | “{name}” couldn't be uploaded. Try again. | تعذّر رفع «{name}». حاول مرة أخرى. |
| `myListing.form.photoRateLimited` | You've uploaded a lot of photos in the last hour. Please try again later. | رفعتَ عددًا كبيرًا من الصور خلال الساعة الماضية. يرجى المحاولة لاحقًا. |
| `myListing.form.ownerPhotoRequired` | Add at least one photo of the property. | أضف صورة واحدة على الأقل للعقار. |
| `myListing.form.draftFound` | We kept what you typed. Restore it? | احتفظنا بما كتبته. هل تريد استعادته؟ |
| `myListing.form.draftRestore` | Restore | استعادة |
| `myListing.form.draftDiscard` | Start fresh | البدء من جديد |
| `myListing.form.draftPhotosNote` | Photos you chose aren't kept — add them again. | الصور التي اخترتها لا تُحفظ — أضفها مرة أخرى. |
| `myListing.form.submit` | Submit for review | إرسال للمراجعة |
| `myListing.form.saveChanges` | Save changes | حفظ التعديلات |
| `myListing.form.saving` | Saving… | جارٍ الحفظ… |
| `myListing.form.submitNotice` | This listing will be reviewed before it appears on the public site. | ستتم مراجعة هذا الإعلان قبل ظهوره في الموقع العام. |
| `myListing.form.editNotice` | Your changes go back for review before they appear publicly. | تعود تعديلاتك إلى المراجعة قبل أن تظهر للعموم. |

Existing form-field labels are reused (`admin.property.*`, `admin.listing.*`, `admin.examples.*`, `enums.*`, `agency.listings.sale/rent`).

### 9.3 Strings — A: admin review and public page

| Key | English | Arabic |
|---|---|---|
| `admin.review.ownerListing` | Private owner | مالك فرد |
| `admin.review.ownerFirst` | Owner's first listing | أول إعلان لمالك |
| `admin.review.editOfReviewed` | Edit of a reviewed listing | تعديل على إعلان سبق مراجعته |
| `admin.review.phoneVerified` | Phone verified | الهاتف مؤكَّد |
| `admin.review.photos` | Photos | الصور |
| `admin.review.removePhoto` | Remove photo | حذف الصورة |
| `admin.review.rejectReason` | Reason (optional, shown to the seller) | السبب (اختياري، يظهر للبائع) |
| `enquiry.contactViaOwner` | Listed directly by the owner. | معروض مباشرة من المالك. |
| `properties.gallery.next` | Next photo | الصورة التالية |
| `properties.gallery.previous` | Previous photo | الصورة السابقة |
| `properties.gallery.close` | Close | إغلاق |

### 9.4 Strings — A: privacy and terms (same build as the data collection; also update the "Last updated" date on both pages to the build date)

`legal.privacy.collectOwner` (new, added to `collectKeys` on the privacy page):
- EN: Private owner details — an owner who lists a property gives us a mobile phone number. We send a one-time code by text message, through an SMS service provider, to check it. We keep the number, the time it was verified, and a scrambled (hashed) copy of the code until it is used or expires. The number is shown publicly on that owner's listings so buyers can call or WhatsApp.
- AR: بيانات الملّاك الأفراد — يزوّدنا المالك الذي يدرج عقارًا برقم جوال. نرسل رمزًا لمرة واحدة عبر رسالة نصية، من خلال مزوّد خدمة رسائل نصية، للتحقق منه. ونحتفظ بالرقم ووقت تأكيده ونسخة مشفّرة (مجزّأة) من الرمز إلى أن يُستخدم أو تنتهي صلاحيته. يُعرض الرقم علنًا على إعلانات ذلك المالك ليتمكن المشترون من الاتصال به أو مراسلته عبر واتساب.

`legal.privacy.collectEnquiry` — change "…and to the estate agency whose listing you asked about" to "…and to the estate agency, or the private owner, whose listing you asked about".
- AR: استبدل «وللمكتب العقاري صاحب الإعلان» بـ «وللمكتب العقاري أو المالك الفرد صاحب الإعلان».

`legal.privacy.shareBody` — replace the sentence "Phone numbers of private individuals are never shown publicly." with:
- EN: A private owner's verified phone number is shown publicly only on that owner's own listings, and only after the owner confirms this on the listing form.
- AR: لا يُعرض رقم هاتف المالك الفرد المؤكَّد علنًا إلا على إعلاناته هو، وبعد أن يوافق المالك على ذلك في نموذج الإعلان.
Also change "visible to the site administrator and to the agency the enquiry is for" to add "(or the owner, for a private owner's listing)" / AR "(أو المالك، في إعلانات الملّاك الأفراد)".

`enquiry.consent`: "…are shared with the listing agency or owner. See our" / «…تتم مشاركة اسمك وبريدك الإلكتروني ورقم هاتفك مع الوكالة أو المالك صاحب الإعلان. راجع».

`legal.terms.listingsBody` — append:
- EN: Private owners may list only properties they own or are allowed to list, may have up to 3 live listings at once, and may upload only photos they have the right to publish, without identifiable people, car number plates or documents. We may remove any listing and suspend any account that looks fake or misleading.
- AR: يجوز للملّاك الأفراد إدراج العقارات التي يملكونها أو المصرَّح لهم بإدراجها فقط، وبحد أقصى 3 إعلانات نشطة في آن واحد، ولا يرفعون إلا صورًا لهم الحق في نشرها دون أشخاص يمكن التعرف عليهم أو لوحات سيارات أو مستندات. يحق لنا إزالة أي إعلان وتعليق أي حساب يبدو وهميًا أو مضللًا.

### 9.5 Strings — B: `workspace` and additions

| Key | English | Arabic |
|---|---|---|
| `nav.myProperties` | My properties | عقاراتي |
| `footer.listWithUs` | List with us | انضم كوكالة |
| `footer.listYourProperty` | List your property | أعلن عن عقارك |
| `account.roles.USER` | Member | عضو |
| `account.roles.AGENCY` | Estate agency | وكالة عقارية |
| `account.roles.ADMIN` | Site administrator | مدير الموقع |
| `workspace.card.agencyTitle` | Your agency workspace | مساحة عمل وكالتك |
| `workspace.card.agencyBody` | Manage your listings and enquiries. | أدر إعلاناتك واستفساراتك. |
| `workspace.card.agencyButton` | Open workspace | فتح مساحة العمل |
| `workspace.card.adminTitle` | Admin desk | مكتب الإدارة |
| `workspace.card.adminButton` | Open admin desk | فتح مكتب الإدارة |
| `workspace.card.ownerTitle` | List your property | أعلن عن عقارك |
| `workspace.card.ownerBody` | Selling or renting out your own home? List it free — we check every listing. | هل تبيع أو تؤجّر منزلك؟ أعلن عنه مجانًا — نراجع كل إعلان. |
| `workspace.card.ownerButton` | My properties | عقاراتي |
| `workspace.stats.delete` | Delete this figure | حذف هذا الرقم |
| `workspace.listing.type` | Type | النوع |

Plan names on the account page reuse `agency.tier.*`. The header's Sign out label is unchanged (`nav.signOut`).

### 9.6 Strings — C: `freeLaunch` and `adminSettings`

| Key | English | Arabic |
|---|---|---|
| `freeLaunch.banner.title` | Free during launch | مجاناً خلال فترة الإطلاق |
| `freeLaunch.banner.body` | List as many properties as you like at no cost while we launch. We'll tell you before paid plans start. | أدرج ما تشاء من العقارات دون أي تكلفة خلال فترة الإطلاق. سنُعلمك قبل بدء الباقات المدفوعة. |
| `freeLaunch.planName` | Free during launch | مجاناً خلال فترة الإطلاق |
| `freeLaunch.allowance` | {count, plural, =0 {No listings yet} one {# listing} other {# listings}} · no limit during the free launch. | {count, plural, =0 {لا توجد إعلانات بعد} one {إعلان واحد} two {إعلانان} few {# إعلانات} many {# إعلانًا} other {# إعلان}} · بلا حد خلال فترة الإطلاق المجانية. |
| `freeLaunch.ownerCta.title` | Selling or renting your own home? | هل تبيع أو تؤجّر منزلك؟ |
| `freeLaunch.ownerCta.body` | Private owners can list up to {limit} properties free. We check every listing before it goes public. | يمكن للملّاك الأفراد إدراج حتى {limit} عقارات مجانًا. نراجع كل إعلان قبل نشره للعموم. |
| `freeLaunch.ownerCta.button` | List as an owner | أدرج كمالك |
| `adminSettings.title` | Site settings | إعدادات الموقع |
| `adminSettings.subtitle` | Switches that change how the whole site behaves. | مفاتيح تغيّر طريقة عمل الموقع بأكمله. |
| `adminSettings.dashHint` | The free launch switch. | مفتاح فترة الإطلاق المجانية. |
| `adminSettings.freeLaunch.label` | Free launch period | فترة الإطلاق المجانية |
| `adminSettings.freeLaunch.on` | On | مفعّلة |
| `adminSettings.freeLaunch.off` | Off | معطّلة |
| `adminSettings.freeLaunch.helpOn` | ON: agencies can have unlimited live listings, whatever their plan. Prices are hidden on the public sign-up page. | مفعّلة: يمكن للوكالات نشر عدد غير محدود من الإعلانات بغض النظر عن باقتها، وتُخفى الأسعار في صفحة التسجيل العامة. |
| `adminSettings.freeLaunch.helpOff` | OFF: each plan's listing limit applies again (Free 3, Premium 25, Business unlimited). Listings already live stay live; an agency over its limit just can't add new ones. | معطّلة: تعود حدود الباقات (المجانية 3، بريميوم 25، الأعمال غير محدودة). تبقى الإعلانات المنشورة كما هي، والوكالة التي تتجاوز حدها لا يمكنها إضافة إعلانات جديدة. |
| `adminSettings.freeLaunch.turnOff` | Turn off free launch | إيقاف الفترة المجانية |
| `adminSettings.freeLaunch.turnOn` | Turn on free launch | تشغيل الفترة المجانية |
| `adminSettings.freeLaunch.confirmOff` | Turn off the free launch period now? Agencies over their plan's limit won't be able to add new listings until they upgrade. | هل تريد إيقاف فترة الإطلاق المجانية الآن؟ لن تتمكن الوكالات التي تجاوزت حد باقتها من إضافة إعلانات جديدة حتى ترقّي باقتها. |
| `adminSettings.freeLaunch.confirmYes` | Yes, turn it off | نعم، أوقفها |
| `adminSettings.freeLaunch.lastChanged` | Last changed {date} | آخر تغيير: {date} |
| `adminSettings.saved` | Saved. | تم الحفظ. |
| `adminSettings.tooMany` | Too many changes. Try again in a minute. | تغييرات كثيرة. حاول بعد دقيقة. |

(Dates use the app's existing Latin-digit date formatting for Arabic.)

## 10. Explicitly OUT of scope

- **The actual SMS provider connection.** Provider choice is the owner's answer to question 5 in `docs/decisions/ads-stats-and-services.md`. This build delivers the switched-off seam (`sendSms` that reports `sent | not-configured | failed`, `isSmsConfigured()`), the code logic, the screens, and the dev-log route. Final environment variable names are set when the owner answers; until then nothing outside development can send.
- Email notifications to owners or agencies about new enquiries (email is its own backlog row); owners must check the page.
- Featured listings, payments, ads (Step 6). Owner-only pricing of "Feature this listing" is not built.
- Auto-expiry / "is this still available?" re-confirmation; a "recently sold" public feature.
- Resizing, cropping, watermarking or converting photos; object storage; making unpublished photos private; cleaning up abandoned drafts automatically.
- Owners changing enquiry status or replying inside the site.
- Delete-my-account and download-my-data (standards §6 asks for them wherever accounts exist; they are **not built anywhere in the app yet**; owner accounts now hold a phone number and listings, so this gap matters more — flag to the owner, separate build).
- Agency payments, tier prices, changing what a tier allows.
- A native app; the rest of the admin desk's phone problems and counting bugs; a friendlier "no access" page for a buyer who opens the agency area.
- Any change to figures, badges or the investment score.

## 11. Done when (a non-developer can check every line)

Owner path (from the plan):
- [ ] A new visitor registers (invite code asked while `SIGNUP_INVITE_CODES` is set), opens **My properties**, is asked to verify a **+968** phone, and gets a **6-digit code** (from the development log locally). A wrong code, an expired code and a fifth wrong try each show their own message in English and Arabic.
- [ ] After verifying, the same visitor adds a **villa in Arabic with three photos**; it says "In review" in My properties and shows in `/admin/review` as **Private owner** and **Owner's first listing**, with the three photos visible and removable — and it appears **nowhere public**, including by opening its property address directly (standard not-found).
- [ ] After the admin publishes it, it shows on `/ar/properties` with the **cover photo**, the listing page has a **working gallery** (next/previous on the correct sides in Arabic), and a **Call / WhatsApp** card with the owner's verified number; nothing public says "verified".
- [ ] A **second account** opening that listing's edit address, and an **agency** account opening it, both get the standard not-found page — the same page as for an address that doesn't exist.
- [ ] An owner with 3 live/in-review listings cannot send a 4th (clear message, no dead button); after withdrawing or marking one sold, they can.
- [ ] Two accounts cannot verify the same phone number.
- [ ] Editing a live owner listing (change the price) hides it from the public until re-approved; the admin card says **Edit of a reviewed listing**. Withdraw removes it from the public browse page; enquiries survive.
- [ ] A buyer's enquiry on an owner listing appears on that owner's listing page and nowhere else.

Photos and form:
- [ ] Photo of 20 MB and a text file renamed `.jpg` are each refused with the file's name and reason beside the photo box, in both languages; nothing is saved.
- [ ] In **Arabic**, choose Villa + foreign ownership, enter a negative price, submit: Villa, the neighbourhood and ownership come back as chosen, and the message is **under the price box**.
- [ ] Open the empty form and press Submit: the browser stops it and jumps to the first missing box.
- [ ] Fill the form in both languages, refresh: you are offered your draft back, and restoring brings back **both the English and Arabic text** of every box.
- [ ] Sending a 12 MB total of photos works (each is its own request); a single 5.1 MB photo is refused cleanly rather than the page failing.

Agency workspace:
- [ ] At **390 px**, My listings shows title, price and status for every listing with **no sideways scrolling**, in English and Arabic; at 1440 px the table looks and works as before and each row opens its listing.
- [ ] Open a listing: Edit, Take it off the site (sold/rented/withdraw), Send for review again. Change a live listing's price → it leaves the public site, shows "Changes in review", appears in the admin queue as an edit. After publishing, the new price is public.
- [ ] Agency B pasting agency A's listing address gets the standard not-found page.
- [ ] Admin market statistics at 390 px: rent, yield, source badge and a separated **Delete this figure** button are all reachable without sideways scroll.
- [ ] Sign in as agency → lands on the agency workspace; as admin → the admin desk; do it again on `/ar` and stay on Arabic pages. The account page shows **وكالة عقارية**, not `AGENCY`, and a workspace card.
- [ ] On a phone, tap **Account** ten times: never lands on Sign out. Every header control and the favourites heart measures at least 44×44 px. The footer link reads **List with us / انضم كوكالة** and goes to `/list-with-us`; the header's "For agencies" goes to the workspace.

Free launch:
- [ ] `/admin/settings` shows the switch **on by default**. With it on, an agency on FREE with 3 live listings can add a 4th and 5th; `/list-with-us` shows "Free during launch / مجاناً خلال فترة الإطلاق" and no prices.
- [ ] Switch off (after the confirm): the same agency is stopped at the 4th with a clear message; prices return on `/list-with-us`; listings already live stay live. Owner cap stays 3 in both states.

Everywhere:
- [ ] Everything above passes on `/en` and `/ar`; no `ml-/mr-/pl-/pr-/left-/right-` classes in new code.
- [ ] Signed out, `curl` of `/en/account/listings`, `/en/agency/listings/<id>` and `/en/admin/settings` returns a redirect whose body contains no listing data.
- [ ] Both privacy and terms pages (English and Arabic) carry the new owner wording, the old "never shown publicly" sentence is gone, and the "last updated" date is the build date.
- [ ] `docs/CONVENTIONS.md` verify recipe passes: `npx prisma migrate deploy`, `npm run db:seed`, `npm run verify`, plus smoke checks (`/en` 200, `/ar` has `dir="rtl"`, `/en/admin` redirects signed out, `/api/health` ok). `/api/health` for a signed-in admin shows `sms: configured | dormant` and the signups mode.

## 12. Tests required (all inside `npm test`, standards §7)

- **A, pure logic:** phone-code make/hash/expiry/attempt-lockout (a code for one number/user fails for another; a wrong or expired code fails; a used code is cleared); the state table and "edit returns to review" (including no-change stays live, photo remove/reorder does not change status); owner cap (3) and drafts cap; "Owner's first listing" rule; `ownsListing` for owner, agency, admin-entered and foreign listings; the public-property rule (no listings = public; only pending/rejected/withdrawn = hidden; one live = public); provenance — an owner or agency submission is always `USER_SUBMITTED` + `PENDING_REVIEW` and never `VERIFIED`, photos never change provenance.
- **A, database-backed (first ones in the repo, using the separate test database):** two owners and two agencies — every core action (save, add/remove/cover/move photo, submit, withdraw, sold, rented, resubmit, delete draft) refuses a listing it does not own and changes nothing; a rejected submit returns **all** failing fields and every dropdown value as submitted; the owner enquiry query returns only that owner's enquiries.
- **A, upload check:** real JPEG/PNG/WebP accepted; renamed non-image refused by its bytes; oversize refused; saved path stays inside `DATA_DIR`; 16th photo refused.
- **C:** `tiers.test.ts` — with the switch on every tier is unlimited; off restores FREE 3 / PREMIUM 25 / BUSINESS ∞; FREE with 3 live is refused a 4th when off and allowed when on; two-argument calls unchanged; the setting reader defaults to **on** and treats unknown values as on.
- **B:** withdrawn/sold/rented listings free a plan slot (`countListingsInPlay`) and disappear from the public search; a withdrawn listing's enquiries survive; the role-based landing decision (pure function) for agency/admin/user with and without a `callbackUrl`.
- **Not testable here:** "submitting a listing keeps you signed in" (September regression) needs a browser; it is part of the Step 8 journeys (app-tester).

## 13. Standards note (`Agents/docs/engineering-standards.md` §6–8)

- **New personal data: YES.** A private owner's mobile number, its verification time and a short-lived hashed code are stored; the number is **shown publicly** on that owner's listings; buyer enquiry details are shown to owners; an SMS provider processes the number. **The privacy page and terms change in this same build** (§9.4) — including the sentence that would otherwise become false ("private individuals' numbers are never shown"). Standing owner item: replace the personal Hotmail contact on both pages (`PRIVACY_CONTACT_EMAIL`), and the lawyer review noted on the pages. Gap noted: no delete-my-account / download-my-data anywhere yet.
- **Touches the core guarantee (provenance and honest labels): YES — tests required** (§12). Owner listings are user-submitted and unverified; a verified phone is never presented as a verified property; an edit cannot leave an old approval publicly visible; unreviewed content is never public (including through the property page).
- **New mutations and external calls: YES.** Twelve new write actions plus one external call (the SMS provider, dormant until keyed). Rate limits are named in §7, keyed per user id, with plain-words refusals. SMS cost exposure is bounded by: signed-in only, invite-gated sign-up, Omani mobiles only, per-user and per-number hourly limits, 60-second resend gap. Limits are in-memory per process (accepted).
- **Backups (§8): photos again.** Owner and agency photos sit on the single-copy `/data` volume, not covered by database backups. `GO-LIVE.md` (A) states the volume must be mounted **before any real photo is uploaded**, the copy-out step in plain English, that owner listings stay closed in production until an SMS provider is keyed, that the free-launch switch is **on by default** and is flipped in `/admin/settings` when paid plans start, and that existing invite codes already cover owner sign-up.

## 14. Open questions (defaults apply if you just say "go")

1. **How many live listings may a private owner have?** Suggested default: **3 at once** (in review + live; drafts don't count). Withdrawing or marking sold/rented frees a slot. Free launch does **not** change this cap.
2. **Are all owner listings reviewed, or only the first?** Suggested default: **every owner listing is reviewed** before it goes public, as agencies' are; the first is flagged "Owner's first listing" so the admin knows to look harder. Later, if the queue is heavy, the first thing to relax is trusted owners' text-only edits — a deliberate later decision.
3. **Do owners need an invite code while `SIGNUP_INVITE_CODES` is set?** Suggested default: **yes — the same gate as buyers**, with no separate owner code. This costs nothing to build: owners are ordinary registered users, and in production with no codes and `SIGNUPS_OPEN` unset, sign-up (so owner listing) is closed.

### Decisions I made that you can overrule (not questions)
- Owners must use an **Omani mobile (+968)** and one phone verifies **one account** (blocks bulk fake accounts and foreign SMS abuse; expats with only a foreign number cannot list yet).
- Owners must add **at least one photo**; agencies need none. Max **15 photos, 5 MB each**.
- **Every content edit to a live listing sends it back to review** (September's default), except removing/reordering/cover photos.
- The free-launch page text promises "We'll tell you before paid plans start" — please confirm you want to make that promise.
- Owners see buyer enquiries on their own listings (read-only) — needed or the buyer's message goes nowhere but the admin.
- Rejected listings can carry a short admin note (one new optional field) so sellers know why.
- The property page is hidden for any property whose only listings are not live (fixes a leak of unreviewed content).

## 15. What I could not check
Mobbin (no access in this session); running the app, tests or git (so the working tree may differ from what I read — builders must confirm each "already exists" claim before relying on it); which SMS provider will be used (open, and the code-storage design deliberately avoids depending on it); real Omani delivery behaviour of any provider.
