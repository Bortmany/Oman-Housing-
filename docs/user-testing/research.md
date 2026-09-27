# Oman Property Intelligence — who the users are and what they will want (2026-09-07)

The single most important finding: the product's "honest data" bet is aimed at a real, well-evidenced problem — fake/duplicate/stale listings and upfront-payment rental scams are the #1 documented complaint against every portal active in or near Oman (dubizzle, OpenSooq, Bayut) [C6][C11][C22][C23] — but the product currently only labels the *provenance of market statistics*, not the *marketplace listings themselves*, which is where competitors' own trust badges (Bayut's TruCheck) and the region's fraud complaints actually live [C4][C24]. Across the five research sweeps, 121 claims were collected: 30 [Certain] (repo-doc, i.e. verified against the actual codebase), 58 [Likely] (medium-confidence search snippets, mostly UAE/US-sourced rather than Oman-dated), and 33 [Guessing] (unsourced model-prior reasoning, including nearly all of the Oman-specific legal/cultural claims). In short: what the product *already does* is solid evidence; what Oman *users specifically* want is mostly informed reasoning, not confirmed fact — treat every Oman-only legal or behavioral claim below as a hypothesis to validate with real Omani agencies and buyers, not a settled requirement.

## 1. Who this user really is

### Persona A — Ahmed, the Cautious Comparer (buyer/investor, Muscat)
**Bio:** Mid-30s professional or overseas investor comparing 3-4 Muscat neighbourhoods (or an ITC project) before committing six figures in OMR; has read at least one scare story about a rental deposit scam.
**Job hired for:** Functional — get a trustworthy price/rent/yield number for a specific area before talking to any agent. Emotional — feel confident he isn't being cheated or misled. Social — have a defensible number to justify the decision to a spouse/family.
**Anxieties:** Being quoted a different (higher) price after contacting an agent [C1]; a listing that's actually already rented/sold [C3][C11]; being asked to pay a deposit before viewing or signing [C6][C10]; not knowing whether an ITC project actually carries freehold rights before reserving a unit [C10][C25].
**Trigger:** Starting to seriously shop (own or rental) and wanting an outside-the-agent number to check listings against.
**First-session moment that must happen:** Landing on a *specific, checkable number* for a neighbourhood he already cares about, with a visible source/date/confidence label — not a generic dashboard shell [C29 — reasoning]. Stanford's web-credibility research says this has to read as trustworthy within about 3-5 seconds or he leaves [C13].
**What brings him back tomorrow:** A reason to check again — a saved neighbourhood watchlist, a price/yield change alert, a calculator scenario he can refine (Nir Eyal's "Investment" stage of the Hook Model: small deposits of effort that create a reason to return) [C14].
**What builds trust:** A named source and confidence figure per number (Zillow states a concrete median error rate rather than a vague "estimated" tag, and that's exactly what earns trust from data-literate users) [C15]; independently-sourced neighbourhood-median comparisons next to any single asking price, so he isn't just anchored on the agent's number [C16].
**What makes him abandon:** Any point in the enquiry flow where he's asked for payment or ID before a viewing [C6][C10]; a listing that turns out stale or misrepresented [C1][C3][C11].

### Persona B — Fatima, the Small Agency Owner (agency)
**Bio:** Runs a 3-5 person agency in Muscat, lists on Bayut/dubizzle/OpenSooq already, wants more qualified leads without becoming a tech company.
**Job hired for:** Functional — get leads and a credible public presence without expensive photography/tech overhead. Emotional — feel her portal spend won't just vanish (paid-boost fees that produce nothing) [C10][C18]. Social — borrowed credibility from appearing on a platform buyers already trust [C30 — reasoning].
**Anxieties:** Paying for a promoted listing that gets deleted or produces zero enquiries [C9][C18]; rigid annual contracts with no room to scale down [C19][C20]; clients disputing commission after a deal closes with no record of the introduction [C21].
**Trigger:** A slow month, or a competitor agency's better-looking online profile.
**First-session moment:** Publishing her first listing in "a few steps" with photos, the way Bayut's flow works [C2], and seeing it land somewhere real (not a black hole pending queue).
**What brings her back tomorrow:** Visible enquiries in her inbox, and (ideally) a response-time badge or reputation signal she's building [C12].
**What builds trust:** Transparent, published pricing she can act on without a sales call [C8][C20]; a support channel that actually answers when something goes wrong with billing [C9][C18].
**What makes her abandon:** Pricing gated behind "contact sales" [C8]; manual approval delays before her listing is visible [C31]; no confirmation her enquiries are actually reaching anyone (no email notification) [C31].

### Persona C — Salim, the Data Curator (operator/admin)
**Bio:** The person (possibly the owner himself, or one hire) who keeps the market-stat and listing data honest — the platform's whole brand promise rests on his work.
**Job hired for:** Functional — approve/verify listings and refresh stats without the process becoming a full-time job. Emotional — never be the reason a wrong or stale number goes out and damages the platform's core trust promise [C27 — reasoning].
**Anxieties:** A listing that's actually a scam slipping through review [C24]; a stat going stale unnoticed; duplicate/conflicting MarketStat rows reaching the dataset if a future bulk-import bypasses the app-level uniqueness check [C32].
**Trigger:** A new agency signs up, or a batch of fresh market data needs entering.
**First-session moment:** Seeing, in one place (the `/api/health` style status view), exactly what's live vs. dormant, and a fast way to review pending listings [C33].
**What brings him back:** A low-friction review queue, not a blank CRUD screen [C27 — reasoning].
**What builds trust (in his own tools):** Clear "still sample/demo data" labeling so he knows what's real vs. seed content [C34]; role checks enforced everywhere so he isn't one bug away from a data leak [C35].
**What makes him abandon (the workflow, not the product):** Manual re-keying from WhatsApp/PDF/spreadsheet sources with no bulk-import path [C28 — reasoning, unverified this round].

## 2. What the market does

| Product | What it offers | Price | Onboarding | Phone experience | One thing loved | One thing hated |
|---|---|---|---|---|---|---|
| Bayut Oman | Search/filter, market-data widget in listings, 3D tours, agent messaging [C2]; TruCheck geo-tagged verified-visit badge + TruBroker responsiveness badge [C4] | Free listing + paid featured/Signature/Hot boosts [C17]; no Oman price sheet found | Any agency can list, reportedly with no verification gate per user complaints [C5] | Dedicated app | "Real properties, real prices, real photos" positioning + TruCheck [C2][C4] | Ghost/stale listings — one complaint claims ~95-99% of listings are effectively fake or non-existent [C3][C11]; reported-listing response time cited at ~78 days [C5] |
| dubizzle/OLX Oman | Post/edit/renew ads, promote-in-locality, saved-search alerts, in-app private chat, ~3,500+ Oman listings [C7] | Freemium + paid promotion | Self-serve classifieds-style | App + web | Alerts and direct chat baseline UX [C7] | Documented rental-deposit fraud using copy-pasted listings; own help center has a dedicated "Fraud, Reporting & Security Tips" category [C6][C22][C23] |
| OpenSooq | Classifieds-style property ads | Paid ad-promotion add-ons | Self-serve | App | Reach/volume | Oman Observer-documented scams: fake QR payment links, ads deleted after paid promotion with unresponsive support [C9][C22] |
| Property Finder | Rich search UX, PF Partner Program agency tiers up to "Diamond" | AED 10,000-30,000/month up to AED 1.2M/year in the UAE; **not confirmed operating in Oman at all** [C36][C8] | Annual-spend lock-in, no mid-contract downgrade [C19] | 4.7-4.8/5 app rating [C1][C13-adjacent] | Polished browse UX | Listed price sometimes doesn't match the real asking price on contact [C1][C19] |
| Mubawab | Bilingual (French/Arabic) listings, AI-driven pricing suggestions, confirmed live in Oman | Freemium | Easy, contact info visible | App | Ease of use, visible contact info [C41] | Thinner Oman-specific evidence than Bayut/dubizzle |
| Zillow / Redfin (global benchmark) | Rent/value estimates, yield/cap-rate/ROI calculator, map-forward search, 86.9%-within-20% disclosed Zestimate accuracy [C15][C40] | Free to browse | Self-serve | 4.7-4.8/5 rated, praised UX [C42] | Map-based search polish [C42] | Estimates admitted to be inaccurate by ±20%+ in thin-data markets, and status can go stale [C16][C43] |
| REIDIN (data benchmark) | Subscription/API market analytics, mainly UAE/Gulf B2B | Sales-call gated, no self-serve, no confirmed Oman coverage [C8] | Sales contact only | N/A (B2B) | Institutional data depth | Zero self-serve access for a retail buyer |
| Hilal Properties (Oman incumbent) | Full-service brokerage: lettings/sales, legal advisory, maintenance, rent collection — not a listings portal [C13] | Not published | Relationship-based | N/A | 40+ years of trust, ~700 lettings/~200 sales units | Not a tech product — no dashboards/self-serve tools |

Where Oman Property Intelligence is different:
- No researched competitor (Bayut, dubizzle, OpenSooq, Mawa, Oman Real, per the repo's own competitor report) publishes structured 24-month historical stats with a provenance + confidence label attached to every number — the closest thing anyone offers is a single market-data widget bolted onto a listing page [C2][C37][C38].
- Its calculators are OMR-native with Islamic financing support, a category no researched competitor was confirmed to offer [C38] — while every regional portal converges on the same freemium listing model OPI's agency tiers already mirror [C17][C39].
- Its AI analyst is designed to cite the same tagged, confidence-capped figures the dashboards show, matching the "grounded, not free-floating" trust framing Zillow itself uses to sell its own AI feature — but OPI's version is dormant and login/question-capped, a self-aware cost/honesty tradeoff the repo's own report already flags as a possible perceived weakness versus "free" competitor chatbots [C25][C44].

## 3. What users say

**Theme: fake and stale listings (strong evidence — repeated across 4 independent sources)**
- "Numerous 'ghost listings' — properties that were already rented or didn't exist ... approximately 95% of listings are fake or non-existent." — Bayut reviewer, via Trustpilot search snippet [C3]
- "Almost 99% of properties advertised are fake ... outdated listings remaining live for weeks or months, with agents claiming properties are rented or sold while advertisements continue to run." — Bayut reviewer (AU Trustpilot snippet) [C11]
- "Any agency can advertise on Bayut without verification ... responses came 78 days late." — Bayut reviewer [C5]

**Theme: payment and deposit scams (strong evidence — Oman-specific and Gulf-wide)**
- "Be aware of Opensooq scams" — headline, Oman Observer, describing fake QR payment links and unresponsive refund support [C9][C22]
- "Scammers posting copy-pasted listings of properties they do not own ... lost more than Dh10,000 in short-term lets and deposits on properties that either did not exist or were not owned." — Gulf News, on Gulf rental fraud [C6]

**Theme: portal billing frustration (medium evidence — agency side)**
- "Charged them for services, then deleted their ads without valid reason, with no response from customer service." — OpenSooq reviewer [C9]
- A small agency described Bayut/Dubizzle's yearly contracts as having "very limited flexibility or support for smaller businesses." — Trustpilot [C20]
- "Paid $199 for access to a pool of qualified tenants but received zero inquiries ... renewal charges at nearly double the usual rate without warning." — Furnished Finder reviewer (landlord-subscription analogue) [C18]

**Theme: estimate/number distrust (strong evidence, directly validates the provenance-label bet)**
- "Zestimate ... infamous in the real estate industry as being the most inaccurate, usually either over or underestimating value by +/- 20%." — forum thread [C16]
- Zillow's own reviewers concede rent-estimate accuracy "varies significantly" by market data density [C1-adjacent, C39].

**Theme: what people actually like (medium evidence)**
- "Real properties, real prices, real photos" positioning plus TruCheck/TruBroker badges are Bayut's answer to the trust gap [C2][C4].
- Zillow/Redfin both praised for map-based search and a clean interface (4.7-4.8/5 ratings) [C42].
- Mubawab praised for visible contact info and ease of use [C41].

## 4. Local facts that change the design

| Fact | Source & date | Design consequence |
|---|---|---|
| Non-GCC foreigners can generally only hold freehold property inside government-designated Integrated Tourism Complex (ITC) zones; ordinary residential districts are Omani/GCC-only | Model-prior, unsourced/undated this round [C25] — **needs primary-source verification (MHUP) before launch** | Every listing/neighbourhood touching an ITC needs an explicit, dated "foreign-ownership eligible" badge — but do not ship it until sourced against a current government page, per the product's own "never show a made-up number" rule |
| ITC development must complete within 4 years of purchase or the government can intervene and auction the land | Model-prior / undated search-snippet [C10][C25] | Show this build-out obligation as a plain-English warning on ITC project pages, flagged for verification |
| Oman has no unified public land-transaction registry comparable to Zillow's US data feed; most "market" figures are agent-reported/asking-price, not verified sale prices | Model-prior, unsourced this round [C26] | The confidence label copy should say plainly that Oman lacks a public sale-price registry — this is *why* confidence is capped, not a footnote |
| OMR is quoted to 3 decimal places (baisa subunit) | Structurally certain, currency-definition fact [C27] | Already a repo convention (Decimal(12,3), formatOMR) [C28] — keep enforcing it on every new money field |
| Weekend is Friday-Saturday; Ramadan compresses business hours (commonly ~9am-2pm) | Model-prior, unsourced/undated [C29] | Agency "typical response time" messaging should adapt for Ramadan/weekend rather than assume a Mon-Fri calendar |
| WhatsApp is the dominant informal enquiry/negotiation channel in Gulf property markets | Model-prior, unsourced this round [C30] | Add a one-tap "Chat on WhatsApp" deep link pre-filled with the listing reference, not an in-app-only enquiry form |
| DLD (Dubai) ran 450 inspections and fined 256 brokers for ad non-compliance in H1 2024 — showing active regional enforcement against fake listings | Search-snippet, dated H1 2024, UAE not Oman [C24] | Treat provenance/moderation as core UI, not a footnote — regulators in the region already treat this as a serious, policed problem |
| Property Finder is not confirmed to operate in Oman at all; the real in-market rivals are Bayut Oman, dubizzle/OLX Oman, and Mubawab | Search-snippet, 2026 [C36] | Position and SEO against Bayut/dubizzle/Mubawab by name — competing with Property Finder's brand recognition would be aiming at the wrong incumbent |
| Online mortgage calculators are broadly criticized for omitting tax/insurance/service fees, leaving only misleadingly low principal+interest figures | CNBC, 2018-dated industry piece [C31] | OPI's mortgage/ROI calculator should let users toggle municipality fees/service charges/maintenance, and label simplified output "principal & interest only" |

## 5. Feature wishlist, ranked (Kano)

**Must-have (they leave without it)**
1. Verified/trust badge on marketplace listings (geo-tagged "still available" confirmation, Bayut-TruCheck-style) — [C4][C3][C11] — buyer/investor — built: **check** (provenance badges exist for stats; no evidence of listing-level verification)
2. Explicit "never pay before viewing/signing" warning at the enquiry step, and never routing payment through the platform — [C6][C9][C22] — buyer/investor — built: **no** (not mentioned in conventions)
3. Auto-expiring/re-confirmed listings so dead inventory doesn't linger — [C3][C11] — buyer/investor — built: **no**
4. Transparent, self-serve OMR agency pricing without sales-call gating or annual lock-in — [C8][C19][C20] — agency — built: **no** (tiers exist in code but are hand-granted by admin, no self-serve payment yet)
5. ITC foreign-ownership status badge, sourced and dated, on relevant listings — [C25][C10] — buyer/investor — built: **check**

**Expected (they assume it)**
1. One-tap WhatsApp contact on every listing — [C7][C30] — buyer & agency — built: **no** (enquiry form only, per conventions)
2. Saved-search / price-change alerts — [C7] and the repo's own competitor report names this as a missing feature — buyer/investor — built: **no**
3. Price-per-square-metre neighbourhood comparison metric — [C37-adjacent Aqarmap] — buyer/investor — built: **check**
4. Minimum photo count / cover-photo guidance on listings (22-27 photos is the cited optimum) — [C33-VHT] — agency & buyer — built: **check**
5. Freemium agency tier: free basic listing + paid visibility boost — [C17][C39] — agency — built: **yes** (Free/Premium/Business tiers exist, though upgrade is manual not self-serve)
6. A usable phone/mobile experience — the repo's own competitor report notes no dedicated mobile app exists while every named competitor has one — buyer & agency — built: **no** (desktop-leaning by design)

**Delighter (they tell a friend)**
1. AI analyst that visibly cites the same tagged/confidence-labelled figures the dashboards use, the way Zillow frames its own AI mode — [C44] — buyer/investor — built: **yes, but dormant** and capped at 10 questions/day
2. A concrete, numeric confidence figure per stat ("based on N data points, ±X%"), not just a qualitative label, mirroring Zillow's own disclosed Zestimate error rate — [C15] — buyer/investor — built: **check**
3. Agency response-time badge on the public profile — [C12] — buyer & agency — built: **no**
4. A timestamped enquiry log an agency can point to as informal proof of introduction, addressing commission disputes — [C21] — agency — built: **check** (enquiry inbox exists; no evidence it's framed this way)
5. A neighbourhood filter that lets a buyer weight "ready-to-live" vs. "yield/resale" priorities rather than one generic ranked list — [C45 — low-confidence reasoning] — buyer/investor — built: **no**

## 6. What they will ask to change

1. "Why did my listing sit pending for days before anyone could see it?" — reason: agency self-signup listings land PENDING_REVIEW and need admin approval [C13] — response: explain this protects buyers from exactly the fake-listing problem named region-wide, and show a visible status/ETA in the portal.
2. "Why do I have to fill out a form — why isn't there just a WhatsApp button?" — reason: WhatsApp is the region's dominant informal enquiry channel [C30] — response: add a WhatsApp deep link alongside the form, not instead of it.
3. "Why can't I just pay online to upgrade my listing tier myself?" — reason: tiers exist in code but are currently hand-granted by an admin, no self-serve Thawani/PayTabs checkout yet [C13][C39] — response: acknowledge it's a known near-term gap (Stripe doesn't serve Oman merchants, a local gateway is planned).
4. "Why didn't I get an email when someone enquired about my property?" — reason: enquiry-notification emails are marked TODO [C31] — response: same — flagged, on the near-term roadmap; check the portal inbox for now.
5. "How do I know this number is actually right?" — reason: this is precisely the industry-wide Zestimate-distrust problem [C16] — response: point to the existing source/confidence label, and consider adding a numeric error margin the way Zillow discloses one [C15].
6. "Why does the AI analyst only let me ask 10 questions a day?" — reason: it's an intentional cost + citation-integrity guardrail, not a bug [C25] — response: explain the cap exists so every answer stays grounded in cited, confidence-scored data rather than a free-floating guess.
7. "Why does the site default to English when I'm Omani?" — reason: bilingual parity is a repo convention, but locale defaulting behavior wasn't confirmed — response: check whether Arabic becomes default for Omani IP/browser-language visitors, not just an available toggle.
8. "There's no mobile app — why do I have to use this on a browser?" — reason: every named in-market competitor (Bayut, dubizzle, OpenSooq, Mawa, Oman Real) has a dedicated app, and the product is explicitly desktop-leaning — response: acknowledge the gap; the trust-critical screens should at minimum be fully usable on a phone today even without a native app.
9. "Why do I need an invite code to sign up?" — reason: sign-up is invitation-only by design during this phase [C13] — response: explain it's a deliberate soft-launch gate, not a bug, and say when open sign-up is planned.
10. "This listing looks like it's already gone — why is it still up?" — reason: the single most-repeated regional complaint is stale/ghost listings [C3][C11] — response: acknowledge and prioritize an auto-expiry/re-confirmation mechanism.
11. "How do I know this ITC project is actually approved for foreign buyers?" — reason: ITC legal status is the single biggest documented foreign-buyer confusion point [C25] — response: commit to sourcing and dating an ITC-status badge per project rather than leaving it to marketing copy.
12. "The map is slow/janky" — reason: the default OSM tile server is explicitly noted as fine for low traffic only [C46] — response: acknowledge as a known scaling item, to be swapped before real traffic arrives.
13. "Why can't I see agency prices without a sales call?" — reason: this is the exact "opaque pricing" complaint leveled at REIDIN/Property Finder-style portals [C8][C19] — response: publish tier prices; that transparency is itself a differentiator worth calling out.
14. "The Arabic version just looks like the English one flipped" — reason: Arabic reading patterns are genuinely under-researched and shouldn't be assumed identical to a mirrored RTL layout [C32] — response: acknowledge charts/maps are intentionally kept LTR by convention, and commit to testing (not assuming) the rest of the Arabic layout with real users.

## 7. What the repo already believed vs. what we found

**Got right:** The "honest data" / provenance + confidence-label bet directly targets the single most-repeated complaint found in every competitor sweep — fake, stale, and misleadingly-priced listings [C3][C5][C6][C9][C11][C22][C23]. The calculator-as-pure-function discipline and OMR-3-decimal handling are exactly the kind of rigor the industry's own mortgage-calculator criticism says is missing elsewhere [C31]. The decision to avoid pay-to-rank/boost gimmicks (per the repo's own competitor report) is well-supported — that mechanic is directly implicated in the fake-listing complaints found against OpenSooq and Bayut.

**Got wrong or stale:** The repo's competitor report treats bilingual/RTL support as parity rather than differentiation, which the evidence confirms — but it's worth restating loudly, because it means "honest data," calculators, and the AI analyst are genuinely the only three defensible differentiators, not RTL. The report's Premium/Business OMR pricing (15-25 / 40-60 per month) is explicitly self-labeled [Guessing] and this research found no independent Oman-specific pricing to confirm or correct it — it remains an open, unvalidated number. The report also frames the AI analyst's 10-question cap as a known-restrictive tradeoff without yet proposing user-facing copy to explain *why* it's capped — this research suggests that framing (cost + honesty guardrail) is worth surfacing explicitly rather than leaving users to assume it's just a worse free chatbot.

**Never considered (in the repo docs):** WhatsApp as the dominant regional enquiry channel; an explicit "never pay before viewing" anti-scam warning at the enquiry step; auto-expiring/re-confirming stale listings; a numeric (not just qualitative) confidence/error-margin figure per stat; an agency response-time badge; and — most importantly — that the product's provenance labeling currently covers *market statistics* but has no confirmed equivalent for *marketplace listings themselves*, which is where the actual fraud complaints concentrate.

## 8. Sources

| # | Claim (short) | Evidence type | Confidence | Source title | Host | URL / file:line | Date |
|---|---|---|---|---|---|---|---|
| C1 | PF app reviewers: listed price ≠ real price on contact | search-snippet | medium [Likely] | Property Finder Real Estate reviews | apps.apple.com | https://apps.apple.com/us/app/property-finder-real-estate/id897540233 | n/d |
| C2 | Bayut Oman app: search/filter, messaging, 3D tours, market-data widget | search-snippet | medium [Likely] | Bayut Oman App - App Store | apps.apple.com | https://apps.apple.com/om/app/bayut-oman/id6736895230 | n/d |
| C3 | Bayut: ~95% of listings called fake/ghost | search-snippet | medium [Likely] | Bayut reviews | trustpilot.com | https://www.trustpilot.com/review/bayut.com | n/d |
| C4 | Bayut TruCheck geo-tagged verification + TruBroker badge | search-snippet | medium [Likely] | Bayut Agent Portal | bayut.com | https://www.bayut.com/agentportal/five-tech-solutions-bayut-offers/ | n/d |
| C5 | Bayut: no verification gate; complaints ~78 days late | search-snippet | medium [Likely] | Bayut reviews | trustpilot.com | https://www.trustpilot.com/review/bayut.com | n/d |
| C6 | Gulf rental scams: copy-pasted listings, deposits on unowned units | search-snippet | medium [Likely] | Beware of online property rental fraud | gulfnews.com | https://gulfnews.com/going-out/society/beware-of-online-property-rental-fraud-1.2253925 | n/d |
| C7 | dubizzle Oman: promote/feature ads, saved-search alerts, private chat | search-snippet | medium [Likely] | Properties for Sale in Oman | dubizzle.com.om | https://www.dubizzle.com.om/en/properties/properties-for-sale/ | n/d |
| C8 | REIDIN: sales-call gated, no confirmed Oman coverage; PF Partner tiers gated on annual spend | search-snippet | medium [Likely] | REIDIN - Data Analytics / PF Partner Program | reidin.com / propertyfinder.ae | https://reidin.com/ ; https://support.propertyfinder.ae/hc/en-us/articles/13157072554514-PF-Partner-Program | n/d |
| C9 | OpenSooq: full of scams, fake QR payment links, ad deleted after paid promotion | search-snippet | medium [Likely] | Be aware of Opensooq scams | omanobserver.om | https://www.omanobserver.om/article/1177678/opinion/business/be-aware-of-opensooq-scams | n/d |
| C10 | ITC freehold verification + 4-year build-out rule + OMR 250k residency threshold | search-snippet | medium [Likely] | Legal Guide to Foreign Property Ownership in Oman | damasturk.com / darglobal.co.uk | https://darglobal.co.uk/blog/buying-property-in-oman-complete-guide | 2025-2026 |
| C11 | Bayut: ~99% of listings called fake, outdated listings stay live for weeks/months | search-snippet | medium [Likely] | Bayut reviews (AU) | trustpilot.com | https://au.trustpilot.com/review/bayut.com | n/d |
| C12 | GCC agents blame response speed, not lead volume, for lost deals | search-snippet | medium [Likely] | Bayut vs Property Finder: Which Portal's Leads Actually Convert? | groovyweb.co / trustpilot.com | n/a | 2025-2026 |
| C13 | Repo: seeded admin login; PENDING_REVIEW moderation; invite-gated signup; manual tier grant; enquiry emails TODO | repo-doc | high [Certain] | docs/CONVENTIONS.md | repo | Oman-Housing-/docs/CONVENTIONS.md:85-163 | 2026-09-01 |
| C14 | Nir Eyal's Hook Model (Trigger→Action→Variable Reward→Investment) | search-snippet | medium [Likely] | The Hook Model: Retain Users by Creating Habit-Forming Products | productboard.com / amplitude.com | n/a | 2025 |
| C15 | Zillow discloses Zestimate median error (4.3%; within 20% 86.9% of the time) | search-snippet | medium [Likely] | What is a Zestimate? | zillow.com / theclose.com | n/a | 2026 |
| C16 | Zestimate/Redfin called inaccurate by ±20%+ | search-snippet | medium [Likely] | Redfin Estimate vs actual sale price thread | teamblind.com | https://www.teamblind.com/post/redfin-estimate-vs-actual-sale-price-ajmvnb5h | n/d |
| C17 | Bayut agent monetization: free listing + paid featured/Signature/Hot boosts | search-snippet | medium [Likely] | Bayut Agent Portal | bayut.com | https://www.bayut.com/agentportal/ | n/d |
| C18 | Furnished Finder: paid for tenant pool, zero inquiries; surprise renewal price hike | search-snippet | medium [Likely] | Furnished Finder reviews | trustpilot.com | https://www.trustpilot.com/review/www.furnishedfinder.com | n/d |
| C19 | UAE brokers protest PF ad rates; fees AED 10-30k/mo up to AED 1.2M/yr | search-snippet | medium [Likely] | COVID-19: Spurned on ad rates, UAE brokers hit back | gulfnews.com | https://gulfnews.com/business/property/covid-19-spurned-on-ad-rates-uae-brokers-hit-back-at-property-portal-1.70973709 | n/d |
| C20 | Small agency: Bayut/Dubizzle yearly contracts rigid, little support for smaller businesses | search-snippet | medium [Likely] | Bayut Reviews | trustpilot.com (uk) | https://uk.trustpilot.com/review/bayut.com | 2025-2026 |
| C21 | Agents complain clients refuse to pay commission after deals close | search-snippet | medium [Likely] | UAE broker/portal disputes coverage | gulfnews.com | n/a | n/d |
| C22 | dubizzle Oman dedicated "Fraud, Reporting & Security Tips" help category | search-snippet | medium [Likely] | Fraud, Reporting & Security Tips — dubizzle Oman | help.dubizzle.com.om | https://help.dubizzle.com.om/hc/en-us/categories/4406242955791-Fraud-Reporting-Security-Tips | n/d |
| C23 | OpenSooq: reported sellers often not removed | search-snippet | medium [Likely] | Opensooq Reviews | smartcustomer.com | https://www.smartcustomer.com/reviews/opensooq.com | n/d |
| C24 | Dubai DLD: 450 inspections, 256 brokers fined for ad non-compliance, H1 2024 | search-snippet | medium [Likely] | Property Fraud in Dubai: How Buyers Protect Themselves | (property-scam blog citing DLD) | n/a | 2024 (cited 2026) |
| C25 | ITC foreign-freehold rules under Royal Decree 12/2006; needs verification | model-prior | low [Guessing] | (unsourced this round) | — | — | undated |
| C26 | Oman lacks a unified public land-transaction registry | model-prior | low [Guessing] | (unsourced this round) | — | — | undated |
| C27 | OMR quoted to 3 decimal places (baisa) | model-prior | low [Guessing] (structurally certain, unsourced this round) | (unsourced this round) | — | — | undated |
| C28 | Repo: OMR stored Decimal(12,3), formatted via formatOMR/formatOMRWhole | repo-doc | high [Certain] | docs/CONVENTIONS.md | repo | Oman-Housing-/docs/CONVENTIONS.md:23-27 | 2026-09-01 |
| C29 | Fri-Sat weekend; Ramadan hours compressed (~9am-2pm) | model-prior | low [Guessing] | (unsourced this round) | — | — | undated |
| C30 | WhatsApp dominant informal enquiry channel in Gulf property markets | model-prior | low [Guessing] | (unsourced this round) | — | — | undated |
| C31 | Online mortgage calculators omit tax/insurance/fees, mislead on true payment | search-snippet | medium [Likely] | When 2+2=5: How mortgage calculators are misleading | cnbc.com | https://www.cnbc.com/2018/12/10/when-225-how-mortgage-calculators-are-misleading.html | 2018 |
| C32 | Arabic eye-tracking shows reverse-Z/holistic scanning, thinner research base than Western UX | search-snippet | medium [Likely] / low for the "thin evidence base" claim | UX Patterns in Arabic-First Applications | kijoo.agency / uxbert.com | n/a | 2025 |
| C33 | VHT Studios: pro photos sell for 32% more, 61% more views; 22-27 photos optimal | search-snippet | medium [Likely] | Mind Blowing Real Estate Photography Statistics | photoup.net / rubyhome.com / modernangles.com | n/a | 2025-2026 |
| C34 | Repo: seeded market/property data is clearly-labeled sample data, replaced via admin | repo-doc | high [Certain] | README.md | repo | Oman-Housing-/README.md:61-63 | 2026-09-01 |
| C35 | Repo: admin role checks enforced per server action, not just layout-level | repo-doc | high [Certain] | docs/CONVENTIONS.md | repo | Oman-Housing-/docs/CONVENTIONS.md:47-48 | 2026-09-01 |
| C36 | Property Finder not confirmed operating in Oman; real rivals are Bayut/dubizzle/Mubawab | search-snippet + repo-doc | medium [Likely] | Property Finder Oman pricing (search) / competitor-analysis report | google.com / repo | Oman-Housing-/docs/competitor-analysis/report-2026-09-01.md:24-34 | 2026 |
| C37 | Aqarmap: price-per-sqm "price guidance" by location | search-snippet | medium [Likely] | Aqarmap - Products, Competitors, Financials | cbinsights.com | n/a | n/d |
| C38 | Repo: OMR-native calculators with Islamic financing; no researched competitor confirmed to match | repo-doc | high [Certain] | docs/competitor-analysis/report-2026-09-01.md | repo | Oman-Housing-/docs/competitor-analysis/report-2026-09-01.md:101-109 | 2026-09-01 |
| C39 | Repo: listing tiers Free 3 / Premium 25 / Business unlimited, hand-granted, no self-serve payment | repo-doc | high [Certain] | docs/CONVENTIONS.md | repo | Oman-Housing-/docs/CONVENTIONS.md:154-163 | 2026-09-01 |
| C40 | Zillow AI mode framed as "grounded in verified listings data...transparency" | search-snippet | medium [Likely] | Zillow debuts AI mode | zillow.mediaroom.com | n/a | 2026-03-25 |
| C41 | Mubawab reviewers: easy to use, contact info visible | search-snippet | medium [Likely] | Mubawab reviews | apps.apple.com | https://apps.apple.com/us/app/mubawab-immobilier-au-maroc/id1036167735 | n/d |
| C42 | Zillow/Redfin rated 4.8/4.7, praised map search and clean UI | search-snippet | medium [Likely] | Redfin / Zillow Google Play listings | play.google.com | https://play.google.com/store/apps/details?id=com.redfin.android | n/d |
| C43 | Zillow status can go stale (shows active/pending after a sale) | search-snippet | medium [Likely] | Zillow/Redfin threads | teamblind.com | https://www.teamblind.com/post/how-accurate-are-redfin-estimates-cbbmdtve | n/d |
| C44 | Repo: AI analyst cites tagged figures, caps confidence ≤0.75, gated 10 Q/day; report flags this as a possible perceived weakness | repo-doc | high [Certain] | docs/CONVENTIONS.md ; docs/competitor-analysis/report-2026-09-01.md | repo | Oman-Housing-/docs/CONVENTIONS.md:134-144 ; report-2026-09-01.md:94 | 2026-09-01 |
| C45 | Retired-expat vs. yield-investor buyer sub-profiles have different risk tolerances | search-snippet | low [Guessing] | Integrated Tourism Complex Oman Guide | aida-oceana.com | n/a (fetch blocked, snippet only) | 2026 |
| C46 | Repo: default OSM map tile server fine for low traffic only, swap before real traffic | repo-doc | high [Certain] | docs/CONVENTIONS.md | repo | Oman-Housing-/docs/CONVENTIONS.md:123-124 | 2026-09-01 |

**Blocked hosts (could not fetch — snippet only):** bayut.com, propertyfinder.ae, dubizzle.com.om, opensooq.com, reidin.com, zillow.com, apps.apple.com, play.google.com, mawa.om, omanreal.com, khaleejtimes.com, aida-oceana.com, rop.gov.om, thawani.om, en.wikipedia.org, ncsi.gov.om, mhup.gov.om, timesofoman.com, haya.om.
