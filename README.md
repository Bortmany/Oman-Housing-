# Oman Property Intelligence Platform

Real-estate data and analysis for Oman, in English and Arabic. Think
"market dashboard + investment calculators for Muscat and Salalah", built so a
marketplace, AI analysis, and agency tools can be added on top later.

**The core promise: honest data.** Every figure on the site carries a label —
Verified, Official statistic, User submitted, or AI estimated — plus a
confidence score. Estimates are never dressed up as facts.

## What works today (Phases 1–2)

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

House rules, the verify recipe, and deploy notes: `docs/CONVENTIONS.md`.
The roadmap (marketplace, AI analyst, agency portal) is at the end of that file —
the database schema for all of it is already in place.
