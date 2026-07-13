# Go-Live checklist — Oman Property Intelligence (Oman-Housing-)

Plain-English list of what to set up before launch. Full context: `Agents/docs/go-live-and-security-audit.md`.

## Host
- **Railway** (described in `docs/CONVENTIONS.md`). Pre-deploy runs `npx prisma db push`; health endpoint is `/api/health`.

## Must do before launch
- [ ] **Postgres database** → set `DATABASE_URL`.
- [ ] **Strong `AUTH_SECRET`** — replace the `change-me` placeholder (`openssl rand -base64 32`).
- [ ] **Set `AUTH_URL`** to the real public web address.
- [ ] **Attach a persistent Volume at `/data`** and set `DATA_DIR=/data`. Uploaded property photos are stored here — without the volume they are wiped on every redeploy.
- [ ] **Set a strong `SEED_ADMIN_PASSWORD`** *before* seeding — it becomes the password for both `admin@example.com` and `agency@example.com`. Then remove or rotate those demo accounts before going public.

## Optional
- [ ] `ANTHROPIC_API_KEY` — turns on the AI property analyst. Without it, the analyst card shows a "not switched on" message; everything else works.
- [ ] `NEXT_PUBLIC_MAP_TILE_URL` — swap the default OpenStreetMap tiles for a real provider (Carto/Protomaps) before heavy traffic.

## Payments
- **Thawani / PayTabs checkout is deferred (not built).** For now you grant Premium/Business tiers by hand from `/admin/agencies`. Stripe is not an option (it doesn't serve Oman merchants).

## Email
- **Deferred.** Enquiry-notification emails to agencies are a `TODO(Phase 5 email)` — not wired to any provider yet. Core browsing and admin work without it.

## Security note
No committed secrets; role checks are enforced in every admin action; uploads and image serving are path-traversal guarded. Just be sure to replace both `change-me` values before deploy.
