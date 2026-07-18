# Go-Live checklist — Oman Property Intelligence (Oman-Housing-)

Plain-English list of what to set up before launch. Full context: `Agents/docs/go-live-and-security-audit.md`.

## Host
- **Railway** (described in `docs/CONVENTIONS.md`). Pre-deploy runs `npx prisma db push`; health endpoint is `/api/health`.

## Must do before launch
- [ ] **Postgres database** → set `DATABASE_URL`. Add `?connection_limit=5` to the end of the URL so the app never opens more database connections than a small Postgres plan allows — without it, Prisma sizes its connection pool automatically and a busy moment can exhaust the database's connection slots. (If the URL already has a `?` in it, append `&connection_limit=5` instead.)
- [ ] **Strong `AUTH_SECRET`** — replace the `change-me` placeholder (`openssl rand -base64 32`).
- [ ] **Set `AUTH_URL`** to the real public web address.
- [ ] **Attach a persistent Volume at `/data`** and set `DATA_DIR=/data`. Uploaded property photos are stored here — without the volume they are wiped on every redeploy.
- [ ] **Set a strong `SEED_ADMIN_PASSWORD`** *before* seeding — it becomes the password for both `admin@example.com` and `agency@example.com`. Then remove or rotate those demo accounts before going public.
- [ ] **Fill in the contact placeholder on the legal pages** — the Privacy Policy (`/privacy`) and Terms of Use (`/terms`) both show "[owner contact email — add before launch]". Put a real contact address in `messages/en.json` and `messages/ar.json` (the `legal.contactBody` text), and have both pages professionally reviewed by a lawyer in Oman — they are plain-language templates, not legal advice.
- [ ] **Swap the map tile server before real traffic** — the map uses the free OpenStreetMap tile server by default, which is for light use only and can block or throttle a busy site. Set `NEXT_PUBLIC_MAP_TILE_URL` to a real provider (Carto/Protomaps). The security headers pick up whichever tile server this is set to automatically — no code change needed.

## Optional
- [ ] `ANTHROPIC_API_KEY` — turns on the AI property analyst. Without it, the analyst card shows a "not switched on" message; everything else works.
- [ ] `NEXT_PUBLIC_MAP_TILE_URL` — see "Swap the map tile server" under **Must do** above; treat it as required once real visitors arrive.

## Payments
- **Thawani / PayTabs checkout is deferred (not built).** For now you grant Premium/Business tiers by hand from `/admin/agencies`. Stripe is not an option (it doesn't serve Oman merchants).

## Email
- **Deferred.** Enquiry-notification emails to agencies are a `TODO(Phase 5 email)` — not wired to any provider yet. Core browsing and admin work without it.

## Security note
No committed secrets; role checks are enforced in every admin action; uploads and image serving are path-traversal guarded. Just be sure to replace both `change-me` values before deploy.
