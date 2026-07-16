# Oman Property Intelligence Platform

Real-estate data and analysis for Oman, in English and Arabic. Think
"market dashboard + investment calculators for Muscat and Salalah", built so a
marketplace, AI analysis, and agency tools can be added on top later.

**The core promise: honest data.** Every figure on the site carries a label —
Verified, Official statistic, User submitted, or AI estimated — plus a
confidence score. Estimates are never dressed up as facts.

## What works today (all five phases built)

**Market intelligence (Phases 1–2)**

- **Market dashboard** (`/en/market`, `/ar/market`) — average sale price,
  monthly rent, price per square metre, and gross rental yield for 11 areas
  (8 Muscat neighborhoods, Muscat Hills, Salalah Center, Hawana Salalah),
  with 24 months of history, trend charts, and apartment/villa filters.
- **Neighborhood pages** — trends, an interactive map with property pins,
  recorded properties, and Integrated Tourism Complex badges where foreign
  ownership may be possible.
- **Compare** — any two areas side by side.
- **Calculators** — rental yield; mortgage with conventional AND Islamic
  financing modes; full ROI with cash flow, break-even, and long-term return.
  All in OMR with its 3 decimal places.
- **Accounts & roles** — email/password login; user, agency, and admin roles.
- **Admin data entry** — screens for adding monthly market statistics
  (with mandatory source labeling) and property records with photo uploads.
- **Arabic throughout** — full right-to-left layout, not an afterthought.

**Marketplace (Phase 3)**

- **Property search** (`/properties`) with filters, property pages with a
  financial analysis card where every figure carries its own provenance
  label, favorites (login required), and side-by-side listing comparison.
- **Admin listing moderation** (`/admin/listings`).

**AI analyst (Phase 4)**

- A **question-and-answer card on each property page** (login required,
  10 questions per user per day). The AI sees ONLY stored, labeled figures —
  the code checks every answer's citations, caps its confidence by the
  weakest figure it cited, and skips the AI entirely when there isn't enough
  data. Needs `ANTHROPIC_API_KEY`; without it the card politely says the
  analyst isn't switched on.

**Business (Phase 5)**

- **Buyer enquiries** on every property (open to everyone, spam-guarded);
  agencies get an enquiry inbox.
- **Agency self-signup** (`/list-with-us`) → an agency portal for submitting
  listings, which land in the **admin review queue** (`/admin/review`)
  alongside unverified user-submitted data.
- **Listing tiers** — Free (3 listings), Premium (25), Business (unlimited),
  granted by hand from `/admin/agencies` until online payments arrive.

**Deferred until external accounts exist:** enquiry-notification emails, and
a Thawani/PayTabs checkout that grants tiers automatically (Stripe does not
serve Oman merchants). Details in `GO-LIVE.md`.

The seeded numbers are clearly-labeled sample data so the dashboards
demonstrate themselves; real figures replace them through the admin screens.

## Run it locally

```bash
cp .env.example .env          # fill in AUTH_SECRET and SEED_ADMIN_PASSWORD
npm install
npx prisma db push            # needs PostgreSQL (see .env DATABASE_URL)
npm run db:seed
npm run dev                   # http://localhost:3000
```

Sign in as `admin@example.com` with the password you set in
`SEED_ADMIN_PASSWORD` to reach the admin screens.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind v4 · PostgreSQL + Prisma 6 ·
Auth.js v5 · next-intl (en/ar with RTL) · Recharts · MapLibre GL.

House rules, the verify recipe, and deploy notes: `docs/CONVENTIONS.md` —
its roadmap section at the end records what each phase delivered and where
the code for it lives. What still needs the owner before a public launch is
listed in `GO-LIVE.md`.
