# Official Omani property data — what exists and how we load it

Researched 30 Sep 2026 for the October alignment round (Step 3, "real data machinery").
Items marked **(unconfirmed)** were seen only in search summaries or pages that would not load —
check them before relying on them.

## Short answer

Official figures exist at **national, governorate and (for some datasets) wilayat** level.
**Nothing official was found at neighbourhood level.** So official figures are stored at
governorate level (or city level where a source names that wilayat and it matches one of our
cities) and are **never spread onto neighbourhoods**. The market pages must say clearly when a
figure is for the whole governorate.

## Sources

### 1. Ministry of Housing and Urban Planning (MOHUP) open data — best raw source
- <https://mohup.gov.om/en/open-data/data/Realestate%20Transaction>
- "Land Buying and Selling": transaction-level land deals, published monthly as CSV / XLSX / XML / JSON.
- Latest period seen: 1–31 Oct 2024 (updated 14 Apr 2025) — a long lag; check for newer files.
- Page labels the geography "Oman"; rows may carry governorate/wilayat columns **(unconfirmed)**.
  Exact columns, and whether price per sqm is present, **(unconfirmed)**.
- The national open-data portal (opendata.gov.om / data.gov.om) also lists sale-contract registrations
  through brokerage offices for some governorates, and a request titled "Oman Real Estate Sales and
  Rental Prices by District (2025)" — whether it was fulfilled is **(unconfirmed)**.

### 2. NCSI — National Centre for Statistics and Information
- <https://www.ncsi.gov.om/>
- Monthly real-estate trading: total value in OMR, split into sale vs mortgage contracts.
  Reported: first seven months of 2026, OMR 1.716bn total (+7.7%); sales OMR 843.2m, mortgages OMR 864.4m
  ([Arabian Business](https://www.arabianbusiness.com/real-estate/oman-real-estate-transactions-hit-4-5bn-as-property-sales-jump-15-7)).
- Quarterly **Real Estate Price Index** with sub-indices for residential land, villas and apartments;
  residential land broken down by governorate. Q1 2026 +15.9% year on year
  ([Oman Observer](https://www.omanobserver.om/article/1191169/business/economy/oman-real-estate-prices-jump-159-in-first-quarter)),
  Q2 2026 +22.7% ([Times of Oman](https://timesofoman.com/article/177120-omans-property-price-index-rises-by-227-in-2026-q2)).
- These are **index values and percentage changes, not OMR prices**. Rent indices **(unconfirmed)**.
  PDF/Excel downloads and reuse terms **(unconfirmed)**.

### 3. Central Bank of Oman
- <https://cbo.gov.om/Pages/PublicationStatistics.aspx>
- Monthly/quarterly bulletins (PDF) with bank credit to housing and real estate. National only, no prices.

### 4. Oman Housing Bank
- No public statistical dataset found **(unconfirmed — not researched in depth)**.

### Licence
The [Open Government License of the Sultanate of Oman](https://opendata.om/open-government-data-policy/)
allows commercial reuse with attribution. Whether it covers each NCSI/CBO publication is
**(unconfirmed)** — which is why every uploaded row must carry its `source_url`.

## How the app stores a figure (checked in the code)

`MarketStat` (`prisma/schema.prisma`) links optionally to a governorate, city or neighbourhood
(all empty = national) and holds `propertyType`, `periodStart`, `avgSalePrice`, `medianSalePrice`,
`avgRentMonthly`, `avgPricePerSqm`, `grossYieldPct`, `transactionCount`, `sampleSize`, plus
`provenance`, `confidence`, `sourceNote`, `sourceUrl`. Every write goes through `upsertMarketStat`
(`src/lib/db/market-stats.ts`, house rule 6), which matches on place + type + period.
There is **no field** today for total traded value, index values or percentage changes — the first
version of the importer ignores those metrics (adding them is an "idea, not built").

## The upload file (CSV) — one row = one figure for one place and one period

| Column | Required | Notes |
|---|---|---|
| `area_level` | yes | `governorate`, `city` or `neighborhood` — stops a name matching at the wrong level |
| `area` | yes | slug, or exact English or Arabic name, matched within `area_level`; unknown or ambiguous → row rejected |
| `property_type` | no | `APARTMENT`, `VILLA`, `TOWNHOUSE`, `PENTHOUSE`, `LAND`, `OFFICE`, `RETAIL`, `WAREHOUSE`; blank = all types |
| `metric` | yes | `avgSalePrice`, `medianSalePrice`, `avgRentMonthly`, `avgPricePerSqm`, `grossYieldPct`, `transactionCount`, `sampleSize` |
| `value` | yes | a number; money in OMR (up to 3 decimals); Arabic-Indic digits are converted before reading |
| `period_start` | yes | `YYYY-MM-01`; a quarter uses its first day |
| `period_type` | no | `month`, `quarter`, `year` — recorded in the note only |
| `source_url` | yes | the official page or file the figure came from |
| `source_note` | no | e.g. "NCSI Q1 2026 bulletin, residential land" |
| `confidence` | no | 0–1, default 0.9 |

The importer — not the file — sets provenance to `OFFICIAL_STAT`. Rows for the same place, type
and period are combined into one `upsertMarketStat` call.

## Level rules (built into the importer)

- NCSI figures → governorate (or national) level.
- MOHUP rows → city level only if the wilayat matches one of our cities; otherwise governorate.
- CBO → national only.
- A row aimed at a **neighbourhood** is rejected unless its source genuinely names that neighbourhood
  (the admin must tick "this source names the neighbourhood" to allow it).
- Pages show governorate-level figures labelled as such ("Muscat governorate, official"), never as
  if they were the neighbourhood's own number.

## Owner / next checks
1. Download the newest MOHUP CSV and record its exact columns and licence text.
2. Check NCSI for downloadable tables and reuse terms.
3. See whether the district-level sales-and-rent dataset exists on the open-data portal.
