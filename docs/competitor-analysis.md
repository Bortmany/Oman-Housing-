# Competitor Analysis — Oman Real Estate Data & Listings Market

Research date: July 2026. Compiled for the Oman Property Intelligence Platform
(market dashboard + investment calculators for Muscat and Salalah).

**Method note:** Direct page fetches to every real-estate site in this space
returned HTTP 403 (bot-blocked) in the research environment. Findings below
come from web search snippets, app-store listings, press coverage, and
official statistics publications rather than direct site crawls — a few
points are flagged **unverified** where no independent confirmation was
found. Treat this as a strong first pass, not a final audit; a manual
site-by-site walkthrough (screenshots, actual navigation) would firm up the
UX and pricing claims.

## Summary

Nobody currently combines, for Oman specifically: (1) neighborhood-level,
monthly market statistics, (2) investment calculators (mortgage/ROI/rental
yield), and (3) a multi-tier data-confidence label (Verified / Official /
User-submitted / AI-estimated). The closest existing competitor — Tamlik —
covers two of the three, with a single confidence tier. This is a real,
defensible gap, not just an untested aspiration.

## Comparison table

| Platform | Type | Oman coverage | Market data | Calculators | Confidence/verification | Arabic/RTL |
|---|---|---|---|---|---|---|
| **Bayut.om** | Listings portal (Dubizzle Group) | Yes, native `.om` site | Group-level "Trends"/valuation tools exist (UAE); **not confirmed** on Oman site | Not confirmed for Oman | None found for Oman | `/en/` path implies Arabic exists; quality unverified |
| **OpenSooq Oman** | Classifieds (broad categories, not real-estate-only) | Yes | None found | None found | "Verified user/business" listing filter only | Arabic-first platform; RTL quality unverified |
| **dubizzle.com.om** | Listings portal (Dubizzle Group) | Yes | None found | None found | None found | Not verified |
| **Tamlik** (tamlikoman.com) | Market-report site | Yes, Oman-native | **Yes** — quarterly, median price/m², rent, gross rental yield, by Muscat area/ITC zone | Not confirmed | Single tier: "verified, active listings" with minimum sample-size filters | Not verified |
| **NCSI** (national stats office) | Official statistics | Yes | Quarterly Real Estate Price Index, **governorate-level only** (not neighborhood), PDF-only, no API/dashboard | No | Official but no confidence tiering (single authoritative source) | Arabic/English PDFs |
| **data.gov.om** | Open data portal | Unclear | No discrete real-estate dataset found (portal itself blocked from direct check) | No | N/A | Unknown |
| **omanpropertyfinder.com** | Local listings site | Yes | None found | None found | None found | Not verified |
| **mawa.om** | Local listings/positioning as broader platform | Yes | Marketing copy claims market-stabilizing role; unverified in practice | Not confirmed | Not confirmed | Not verified |
| **Property Finder / Data Finder** | Pan-Gulf portal + B2B data product | **No** — UAE/KSA/Qatar/Bahrain/Egypt/Morocco/Lebanon/Turkey only | Data Finder is UAE-only (Dubai Land Department data) | N/A for Oman | N/A for Oman | N/A for Oman |
| **TruEstimate** (Bayut/Dubizzle Group) | AI valuation tool | **No** — UAE-only, depends on Dubai Land Department transaction data | AI valuations + rental-yield estimates | Rental yield estimate | Single "AI-estimated" style output, UAE only | N/A |
| **Wasalt** | Saudi platform (REGA-licensed) | **No** — Saudi-only; occasionally *lists* Omani developer projects | None for Oman | Not confirmed | "Verified" listings/brokers model (Saudi) | Not verified |

## Findings by competitor

### Bayut.om
Standard listings portal: search/filters (type, beds, price in OMR, location), map, saved-search alerts. Bayut's UAE flagship valuation tool, **TruEstimate**, and its mortgage/"Trends" market-analysis section are **not confirmed to exist on the Oman site** — they depend on Dubai Land Department transaction data that doesn't exist for Oman, so a port is unlikely without an equivalent Omani data source. Business model for Oman agents is unconfirmed, but Bayut's UAE playbook is a paid agent/lead-gen "Agent Portal." General Bayut/UAE reviews cite complaints of stale or fake listings and slow support — not confirmed Oman-specific, but a plausible risk pattern to watch for.

### OpenSooq Oman
A broad classifieds marketplace (real estate is one category among many), not a real-estate specialist. No valuation, ROI, or market-data tooling found. Monetizes via paid ad promotion tiers (Promoted / Turbo / VIP), pricing not published. Reviews (mostly for the wider OpenSooq platform, not Oman specifically) flag scam/fraud complaints and weak moderation — a trust gap a "data honesty" positioned platform can contrast against directly.

### dubizzle.com.om
Same corporate family as Bayut (Dubizzle Group); a plain Oman listings portal with no data/analytics layer found.

### Tamlik (tamlikoman.com) — closest direct competitor
Publishes a **quarterly Oman market report**: median price/m², monthly rents, and gross rental yields by Muscat area and ITC (freehold) zone. Methodology is stated explicitly: medians drawn from active, verified listings, with minimum sample-size thresholds (≥5 sale / ≥3 rent listings) before an area gets a published figure. This is the only found source doing area-level, methodology-transparent Oman market data. It does **not** appear to offer mortgage/ROI calculators, monthly (vs. quarterly) refresh, Salalah coverage, or a multi-tier confidence system (Verified vs. Official vs. User-submitted vs. AI-estimated) — it has one tier ("verified, sufficient-sample listings"). Worth a manual follow-up visit to confirm calculator absence and check its Arabic/RTL handling directly.

### NCSI (National Centre for Statistics and Information)
The authoritative government source. Publishes a quarterly Real Estate Price Index (e.g., Q1 2026: residential +17.6% YoY, land +21%, villas +9%, apartments +4.4%), broken out by **governorate** (Muscat, Dhofar, Al Buraimi, Musandam, etc.) — not by neighborhood. Distributed only as PDF reports via an e-library; no API or interactive dashboard. This is the natural "Official statistic" source tier for the platform's honesty-labeling system, but its coarse granularity (governorate, quarterly) is exactly the gap a neighborhood-level, monthly dashboard fills — the platform isn't competing with NCSI, it's productizing what NCSI doesn't publish at that resolution.

### data.gov.om
Oman's open-data portal exists, but no discrete real-estate/property price dataset surfaced in search, and the portal itself blocked direct fetch attempts in this environment. Flagged as **unverified/likely absent** rather than confirmed empty — worth a manual check.

### Smaller local sites (omanpropertyfinder.com, mawa.om, omanreal.com)
Plain listings aggregators or unverifiable/low-signal sites. mawa.om's marketing copy claims a broader market-stabilizing role but this is unconfirmed by any independent evidence found. omanreal.com produced no usable search results — likely low-traffic or inactive. None of these appear to be credible threats on the data/analytics front.

### Pan-Gulf platforms (Property Finder, Data Finder, TruEstimate, Wasalt)
None currently operate in Oman. Property Finder's core markets are UAE, Bahrain, Qatar, Saudi Arabia, Egypt, Morocco, Lebanon, and Turkey; its Data Finder market-intelligence product is UAE-only and depends on Dubai Land Department data. TruEstimate (Bayut/Dubizzle Group's AI valuation tool, >97% claimed accuracy, backing over half of Dubai's ready-property deals) is likewise UAE-only for the same data-dependency reason. Wasalt is Saudi-only (REGA-licensed) and only occasionally *lists* Omani developer projects without any Oman-specific data product. This is a genuine market-entry gap: the well-funded pan-Gulf players have not brought their valuation/data tooling to Oman, most plausibly because they lack an Omani land-registry data-sharing relationship equivalent to Dubai's DLD — which is itself a moat point worth remembering (their tooling depends on government transaction-data access the platform would need its own path around, e.g. admin-entered + user-submitted + AI-estimated data with honest labeling instead of waiting for a DLD-equivalent).

## Whitespace / opportunities

1. **Neighborhood-level, monthly refresh** — nobody found publishes at this granularity for Oman; NCSI stops at governorate/quarterly, Tamlik at area/quarterly.
2. **Multi-tier confidence labeling** (Verified / Official / User-submitted / AI-estimated) — no competitor found has more than one tier (Tamlik's single "verified" tier is the closest analog). This is a differentiator worth foregrounding in marketing copy specifically against Tamlik and NCSI.
3. **Investment calculators bundled with market data** — mortgage (conventional + Islamic), rental yield, and full ROI/cash-flow calculators were not found on any Oman-focused competitor. Bundling these with the honest-data dashboard (rather than as a generic standalone calculator) is a combination nobody else offers.
4. **Salalah coverage** — every competitor found is Muscat-centric; Salalah Center and Hawana Salalah coverage is close to uncontested.
5. **Trust positioning against classifieds fraud** — OpenSooq's scam/moderation complaints are a concrete contrast point for a "data honesty" brand promise.
6. **No DLD-equivalent dependency** — pan-Gulf players' data tooling depends on government transaction-data partnerships Oman doesn't yet offer at Dubai's level; an admin+user+AI-estimated model with clear labeling is a viable substitute path that doesn't wait for that data-sharing relationship to exist.

## Gaps in this research (recommended follow-ups)

- Manual, logged-in walkthroughs of Bayut.om, OpenSooq Oman, and especially **Tamlik** to directly confirm calculator presence/absence and Arabic/RTL quality — all fetch attempts were blocked in this pass.
- Pricing verification for Bayut.om and OpenSooq Oman agent/promotion tiers in OMR.
- A direct check of data.gov.om for any real-estate dataset.
- Periodic re-check: this is a fast-moving space (Bayut/Dubizzle rolled out TruEstimate in the UAE only recently) — a pan-Gulf player bringing valuation tooling to Oman would materially change the competitive picture.
