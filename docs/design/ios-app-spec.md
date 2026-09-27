# Oman Property Intelligence — iOS App Design Spec

*A written design document only — no code. A future iOS developer (or a
wrapper project) should be able to build from this. The existing Next.js API
is the backend; nothing here changes it.*

## 1. What the app is and who it's for

Oman Property Intelligence is real-estate data and analysis for Oman, in
English and Arabic: a market dashboard for 11 areas (Muscat neighborhoods and
Salalah) with 24 months of history, investment calculators in OMR, and a
property marketplace with agency listings and an AI analyst. The core promise
is **honest data** — every figure carries a provenance badge (Verified,
Official statistic, User submitted, AI estimated) plus a confidence score,
and the iOS app must carry those badges everywhere a number appears; a native
app that drops them breaks the product's one law. The app is for property
buyers, investors and renters in Oman, and agencies watching the market.
Admin data entry and moderation stay web-only. **Bilingual AR/EN with full
RTL is mandatory.**

## 2. Navigation model

**Tab bar — 5 tabs:**

| Tab | Existing screen it maps to |
|---|---|
| Market (السوق) | Market dashboard + neighborhood pages |
| Properties (العقارات) | Marketplace search, property pages, comparison |
| Calculators (الحاسبات) | Rental yield, mortgage (conventional + Islamic), ROI |
| Saved (المحفوظات) | Favorites + saved comparisons (login required) |
| More (المزيد) | Account, agency portal entry, enquiry inbox (agencies), language, about |

**Not in the app:** admin statistics entry, listing moderation, and the
review queue — desk work, web-only. Agency listing *submission* also stays
web-first for v1 (photo-heavy form); the app gives agencies their enquiry
inbox so they never miss a buyer.

**Modals:** calculator input sheets, enquiry form (sheet on a property
page), AI analyst question (sheet), area picker, login (sheet, only when an
action needs it — browsing never requires an account).

**Deep links** (`omanproperty://` + universal links matching web routes):
`market/<areaSlug>`, `properties/<id>`, `calculators/mortgage`,
`compare?a=…&b=…`. Every shared property link opens the app when installed.

## 3. Screen-by-screen notes

Design language: **stone + teal data product** — warm stone neutrals, teal
for data lines, badges and actions; the feel of a serious statistics product,
not a glossy listings portal. Charts are the furniture. Provenance badges are
small colored chips beside every figure, with tap-to-explain ("Official
statistic — NCSI, March 2026 — confidence 90%").

**Market (home)** — headline strip: average sale price, monthly rent, price
per m², gross rental yield for a chosen area, each with its badge. Area
switcher across the 11 areas; apartment/villa filter. Trend chart with 24
months of history, scrubbing with haptic ticks and the value + badge shown
at the scrub point. Neighborhood page: trends, the property-pin map
(MapKit-style native map), recorded properties, and the Integrated Tourism
Complex badge where foreign ownership may be possible — buyers from abroad
care; keep it prominent.

**Compare** (reached from Market) — two areas side by side, the existing
metric rows, badges intact. A natural iPad/landscape screen.

**Properties** — search with filters (area, type, price, beds), list/map
toggle. Property page: photo gallery, details, the **financial analysis card
where every figure carries its own provenance label** (yield estimate,
price-per-m² vs area average), favorite button (heart, login-gated),
enquiry button, and the **AI analyst card**: ask a question, login required,
10 questions per user per day, and the honest empty state when the analyst
is off or data is insufficient ("Not enough verified data to answer that")
— the native app keeps the refusal behavior, never softens it.

**Calculators** — three calculators as clean native forms with big OMR
results: rental yield; mortgage with a conventional/Islamic financing
segmented control; full ROI with cash flow, break-even and long-term return.
OMR always shows its 3 decimal places — house money rule. Results are
computed by the same logic as the web (call the API where the web does;
these are deterministic and could be mirrored locally for offline, but any
mirror must be tested against the web's outputs). Each calculator gets a
"share result" card.

**Saved** — favorited properties with price and badge summary; saved
side-by-side comparisons. Sign-in prompt if logged out.

**More** — account, language toggle (English / العربية), agency section
(enquiry inbox for agency accounts: buyer name, phone, message, tap to call
or WhatsApp), notification preferences, the data-honesty explainer page
(what each badge means — good onboarding material too), sign out.

## 4. Native affordances

**Widgets:**
- **Area watch (medium):** the user's chosen neighborhood — average price,
  rent, yield, each with its tiny badge, and the month-over-month arrow.
  Stone background, teal figures. The "is Qurum moving?" glance.
- **Small:** one metric for one area, user-configurable.

**Notifications (opt-in, specific, no noise):**
- "New monthly statistics published for ⟨area⟩" — when admin enters the
  month's data.
- Saved-search alert: "2 new listings match your Al Mouj search."
- Agencies: "New enquiry on ⟨listing⟩" — the one that makes agencies keep
  the app.
- All three need a small server push addition (APNs) — flag for the owner,
  not built silently.

**Haptics:** tick on chart scrubbing; light confirm on favoriting; nothing
theatrical — this is a data product.

**Share sheet:** property pages (universal link + preview image), calculator
result cards, an area market-summary card (chart + badges + wordmark) —
each rendered image keeps the provenance badges visible, so shared numbers
stay honest outside the app too.

**Arabic/RTL behavior:** full mirror in Arabic — tabs, navigation, chevrons,
chart y-axis moves to the right, comparison columns swap. Western Arabic
digits (0-9) for all figures, matching the web. Mixed-direction strings
(Arabic sentence + Latin project name like "Al Mouj") tested explicitly.
The App Store listing ships in both languages.

**No Face ID gate** — nothing here is more sensitive than a favorites list.

## 5. Dark/light mode

**Both, following the system.** Light is the primary reading mode (stone
surfaces, teal data); dark mode uses deep warm grey — not pure black — with
teal lines brightened for contrast. Charts and badges must pass contrast
checks in both. Manual override in More.

## 6. Data & sync

- Talks to the existing Next.js API; browsing endpoints are public, while
  favorites, enquiries-inbox and the AI analyst require the session token
  (Keychain). The 10-questions-per-day AI limit is enforced server-side; the
  app just displays the remaining count.
- **Offline:** last-viewed market dashboards, neighborhood trends and saved
  properties are cached and shown with a visible "data as of ⟨date⟩" stamp —
  honesty rule extends to staleness. Calculators work offline only if the
  mirrored-locally decision above is taken; otherwise they show a friendly
  "needs a connection" state. Enquiries and AI questions require a
  connection (never queue a question against a daily quota).

## 7. App Store notes

- **Category:** Lifestyle (Apple's home for real-estate apps; Finance is the
  secondary). **Age rating:** 4+.
- **Privacy questionnaire (honest answers):** email (account), favorites and
  saved searches (linked to account), enquiry details (name, phone, message
  — sent to the listing's agency), coarse usage of the map (no precise
  location is collected unless a "near me" feature is added later — it is
  not in this spec). No tracking, no ads, no data sold.
- The AI analyst answers only from stored, labeled figures with citation
  checks — state this in App Review notes; review is increasingly wary of
  AI features that could hallucinate financial claims, and this app's
  honesty architecture is the answer.
- Account deletion reachable in-app (More) — App Store requirement.
- Listing in English and Arabic with localized screenshots.
