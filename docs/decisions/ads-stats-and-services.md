# Oman Property — payments, ads, visitor stats, SMS and maps: decision

Written 30 Sep 2026 for the October alignment round (Step 2). **Research only — nothing has been
signed up for, bought or switched on.** Every service below is built "dormant until keys": the code
is ready and does nothing until you add the keys, exactly like the CAPTCHA and email today.

Please answer the six questions in the box at the end. Where you just say "go", the recommendation
is what gets built.

---

## 1. Payment gateway — **Thawani Pay** (bank transfer as the fallback)

The shared file `Agents/docs/decisions/oman-payments.md` (written by the Dukkani session) covers
Dukkani's shop prices but does **not yet name a gateway**. This is the recommendation for all three
OMR apps; once you agree, it should be copied into that shared file.

| | Thawani Pay | PayTabs | Tap Payments | Bank transfer |
|---|---|---|---|---|
| Fees | not published — ask merchant@thawani.om | custom quote; no setup/monthly fee (third-party) | ~2.75% cards + 5% VAT on the fee (third-party, unconfirmed) | none |
| Needs a commercial registration (CR) | yes (CR, ID, bank statement, forms) | unconfirmed | unconfirmed | no |
| Hosted checkout, webhooks, test mode, refunds | yes, all documented; amounts in baisa (3 decimals handled) | hosted page yes; webhook signing / test mode unconfirmed | OmanNet yes; rest unconfirmed | n/a |
| Settlement | unconfirmed | weekly (Mondays), min OMR 120, in OMR | unconfirmed | manual |

**Why Thawani:** Omani, OMR-native, and **Dukkani already has it built** (switched off until keys are
set — `Dukkani/src/lib/integrations/thawani.ts`), so Oman Property copies a proven pattern.
**Risk:** it needs a CR — ask Thawani whether a sole-trader registration is accepted.
**Until then:** featured listings and ads can be sold by invoice + bank transfer, and the admin
features a listing by hand (built in Step 6).

Your steps (when ready): email merchant@thawani.om for the rate card, settlement schedule and the
sole-trader question → register at merchant.thawani.om → test keys → live keys + one real payment.
Ask PayTabs for a quote in parallel as a backup.
Sources: thawani.om/payment-gateway · Thawani e-commerce API docs (stoplight) · ai.paytabs.com/en/oman-payment-gateway ·
PayTabs OmanNet support article · developers.tap.company/docs/omannet — all checked 30 Sep 2026.

## 2. Prices — featured listings and ads (all OMR)

**No Omani portal publishes its prices**, so these are careful estimates, not copies of a market rate.
Start low, and raise once real visitor numbers exist.

| Item | Launch price (first 3 months) | Later price (once traffic is proven) |
|---|---|---|
| Featured listing — private owner, 30 days | **3.000** | 6.000 |
| Featured listing — agency, 30 days, per listing | **6.000** | 12.000 |
| Home-page ad band, per month | **60.000** | 250.000 |
| Market-page sidebar ad, per month | **35.000** | 120.000 |
| Ad below a property's money figures, per month, per area | **45.000** | 180.000 |
| Neighbourhood page sponsorship, per month (one sponsor only) | **30.000** | 100.000 |

Why these: a Premium agency plan is planned at 15–25 OMR/month for 25 listings (competitor report
§6), so one featured listing at 6 OMR stays clearly below a plan. At launch there is almost no traffic, so
"per 1,000 views" pricing (about 1–3 OMR) would earn nearly nothing — flat monthly fees for founding
partners make more sense. Later price ≈ expected monthly views × 3–6 OMR per 1,000.
To keep trust (our whole brand): **at most 3 featured listings per results page, always labelled
"Featured / مميز"**; ads always labelled "Ad / إعلان".

## 3. How ads are sold at first — direct deals, no ad networks

1. A one-page rate card and an honest description of the site (no traffic claims we can't back up).
2. "Founding partner" offer to the first 5–8 banks, developers and movers: launch price locked for 3 months, and their slot is theirs alone.
3. Agree slot, dates and artwork (English + Arabic) by email or WhatsApp.
4. Invoice up front by bank transfer — monthly or for the 3 months.
5. Send a simple monthly report of views and clicks (the site counts these itself).
6. Before the term ends, offer renewal at the later price — or extend the launch price if traffic hasn't grown.

No third-party ad scripts, ever — which also keeps the privacy page simple.

## 4. Visitor stats — **Plausible Cloud** (about $9/month)

| Tool | ~10k views/month | ~100k | Cookies? | Upkeep |
|---|---|---|---|---|
| **Plausible Cloud** | **$9** | ~$19 (unverified) | none, no consent banner needed (Plausible states this) | none; EU-hosted |
| Umami Cloud | $0 (free up to 100k events) | $0, then $20 | none | none |
| Umami on Railway | ~$5+ | similar | none | we'd look after a server + database |
| GoatCounter | $15 (business use) | $15 | none | none |

Recommendation: Plausible — simplest and cleanest. **If you'd rather pay nothing, say "Umami"** and
the code is the same shape. Built tool-neutral behind `NEXT_PUBLIC_STATS_SCRIPT_URL` /
`NEXT_PUBLIC_STATS_SITE_ID` (see `docs/specs/oman-property/align-7-seo-and-stats.md`), so switching tool later is just new values;
with them unset, no script loads and the security rules are unchanged (same pattern as the CAPTCHA).
Your steps: sign up at plausible.io (30-day trial, no card) → add the site → copy the snippet → set the two values on Railway.
Sources: plausible.io pricing and docs · umami.is/pricing · goatcounter.com — checked 30 Sep 2026.

## 5. SMS phone codes — **Twilio Verify** (about $0.27 per code)

Used so private owners prove their Omani phone number before listing.

| | Twilio Verify | Unifonic (GCC) | Vonage Verify |
|---|---|---|---|
| Cost per code to +968 | ~$0.27 ($0.2158 SMS, published; + ~$0.05 check fee, unconfirmed) | unconfirmed (UAE ~AED 0.10) | ~$0.057 + SMS (unconfirmed) |
| Setup | account + "Verify service" + switch Oman on | trade licence + two stamped letters for sender-ID registration | account |
| Developer side | two simple calls; test mode | REST only | SDK |
| WhatsApp codes too | yes (needs Meta approval) | yes | yes |

Why Twilio: easiest to switch on, test mode built in, WhatsApp later with the same code. Oman is a
"grey route" market, so test with real Omantel **and** Ooredoo numbers before launch.
Keys the code will expect: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`.
Until set: in development the code appears in the server log; in production owner sign-up shows
"phone checks not switched on yet".
Sources: twilio.com/en-us/sms/pricing/om · Twilio Oman sender-ID article · Unifonic Oman sender-ID docs · vonage.com Verify pricing — checked 30 Sep 2026.

## 6. Map tiles — **Protomaps, one Oman map file on Cloudflare R2** (about $0–15/month)

| | Cost at 50k / 500k map loads | Business use | Arabic place names | Works with today's map code |
|---|---|---|---|---|
| **Protomaps (self-hosted file)** | **~$0–5 / ~$5–15** | yes | **yes** | needs a small change (different map type) |
| Carto | free up to ~33k loads, then **$500/month** | with a free key | unconfirmed | yes (just a key) |
| MapTiler | ~$93 / ~$1,200 | yes | yes | yes |
| Stadia Maps | $80 / $250 | paid plans only | unconfirmed | yes |

(Load estimates assume ~30 tiles per map view — a rough guess.)
Why Protomaps: by far the cheapest at any size, allowed for business use, and shows Arabic names.
The code change is small (the `pmtiles` add-on for our existing map library) and fits inside Step 5.
Built behind a new `NEXT_PUBLIC_MAP_PMTILES_URL`; the current `NEXT_PUBLIC_MAP_TILE_URL` stays as
the fallback. **Zero-effort alternative:** Carto with a free key, fine until ~33k map loads a month.
Your steps: Cloudflare account → R2 bucket with a custom address (e.g. tiles.yourdomain) → allow
browser range requests (CORS) → upload the Oman file (the build session can prepare the file for you).
Sources: carto.com/legal/basemap-terms (updated 29 Sep 2026) · maptiler.com/cloud/pricing · stadiamaps.com/pricing · docs.protomaps.com (localization, cost) — checked 30 Sep 2026.

---

## ✅ Your answers (reply with the numbers, or "go" to accept all recommendations)

1. **Gateway:** Thawani (with bank transfer until it's live) — or PayTabs / other?
2. **Featured price:** launch 3.000 owners / 6.000 agencies per 30 days — or different?
3. **Ad prices:** the launch column above — or different?
4. **Visitor stats:** Plausible ($9/month) — or Umami (free)?
5. **SMS codes:** Twilio Verify — or Unifonic?
6. **Map tiles:** Protomaps (small code change, near-free) — or Carto (no change, free to ~33k loads)?

No account is opened and nothing is paid by any agent — each sign-up goes into `GO-LIVE.md` as
your step when the matching feature is built.
