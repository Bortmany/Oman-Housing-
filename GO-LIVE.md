# Go-Live checklist — Oman Property Intelligence (Oman-Housing-)

Plain-English list of what to set up before launch. Full context: `Agents/docs/go-live-and-security-audit.md`.

## Host
- **Railway** (described in `docs/CONVENTIONS.md`). Pre-deploy runs `npx prisma migrate deploy` (applies the committed database migration files); health endpoint is `/api/health`. Node is pinned to version 22.

## Database migrations (one-time note)
- The database schema is now managed by migration files in `prisma/migrations/`. The first one (`20260906000217_init`) creates every table from scratch.
- **If a database was ever set up the old way (`prisma db push`)** — its tables already exist, so the init migration must be marked as already done, or the first deploy will try to create tables that are already there and fail. Run this **once** against that database before the first `migrate deploy`:
  `npx prisma migrate resolve --applied 20260906000217_init`
  A brand-new, empty database needs nothing — `migrate deploy` builds it.

## Must do before launch
- [ ] **Postgres database** → set `DATABASE_URL`. Add `?connection_limit=5` to the end of the URL so the app never opens more database connections than a small Postgres plan allows — without it, Prisma sizes its connection pool automatically and a busy moment can exhaust the database's connection slots. (If the URL already has a `?` in it, append `&connection_limit=5` instead.)
- [ ] **Strong `AUTH_SECRET`** — replace the `change-me` placeholder (`openssl rand -base64 32`).
- [ ] **Set `AUTH_URL`** to the real public web address.
- [ ] **Attach a persistent Volume at `/data`** and set `DATA_DIR=/data`. Uploaded property photos are stored here — without the volume they are wiped on every redeploy.
- [ ] **Set a strong `SEED_ADMIN_PASSWORD`** *before* seeding — it becomes the password for both `admin@example.com` and `agency@example.com`. Then remove or rotate those demo accounts before going public.
- [ ] **Have the legal pages reviewed** — the Privacy Policy (`/privacy`) and Terms of Use (`/terms`) are plain-language templates, not legal advice; have both professionally reviewed by a lawyer in Oman. The contact address on both pages defaults to the owner's own (`naeljam@hotmail.com`); to show a different one, set `PRIVACY_CONTACT_EMAIL` (see Optional below).
- [ ] **Set `SIGNUP_INVITE_CODES` before launch** — a comma-separated list of invite codes, each 8+ characters (e.g. `muscat-2026-alpha,salalah-2026-beta`). Both sign-up forms (buyer register and agency list-with-us) then ask for a code. Without it, production sign-up is **closed** to everyone (the safe default). Rotate or revoke a code by editing the variable and redeploying. When payments exist and you want everyone in, set `SIGNUPS_OPEN="true"`. A signed-in admin can confirm the mode at `/api/health` (`signups: open | invite | closed`).
- [ ] **Set `TRUST_PROXY_HEADERS="true"` on Railway.** Railway's edge network overwrites `X-Forwarded-For` itself, so this is safe there and turns on real per-visitor-IP rate limiting for login/signup. Without it, the app falls back to a per-browser cookie for anonymous rate limiting (still safe, but weaker — see `.env.example`), and logs a warning in production every time it starts.
- [ ] **Swap the map tile server before real traffic** — the map uses the free OpenStreetMap tile server by default, which is for light use only and can block or throttle a busy site. Set `NEXT_PUBLIC_MAP_TILE_URL` to a real provider (Carto/Protomaps). The security headers pick up whichever tile server this is set to automatically — no code change needed.

## Optional
- [ ] `ANTHROPIC_API_KEY` — turns on the AI property analyst. Without it, the analyst card shows a "not switched on" message; everything else works.
- [ ] **Cloudflare Turnstile (free CAPTCHA)** — `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Create a free Cloudflare account, open Turnstile → Add site, enter the app's domain, and copy the site key and secret key. Once BOTH are set, a "verify you're human" box appears on the login, register and list-with-us forms and every submission is checked. Until then it's dormant — no box, no checks. Signed-in admins can confirm it at `/api/health` (`captcha: configured`).
- [ ] `SENTRY_DSN` — error alerts. Empty = off.
- [ ] `PRIVACY_CONTACT_EMAIL` — the contact address shown as a mailto link on the Privacy Policy and Terms of Use pages. Leave unset to use the owner's address (`naeljam@hotmail.com`).
- **Password reset is not built.** The site is invitation-only for now; the owner resets a forgotten password by hand from the database.
- [ ] `NEXT_PUBLIC_MAP_TILE_URL` — see "Swap the map tile server" under **Must do** above; treat it as required once real visitors arrive.

## Payments
- **Thawani / PayTabs checkout is deferred (not built).** For now you grant Premium/Business tiers by hand from `/admin/agencies`. Stripe is not an option (it doesn't serve Oman merchants).

## Email
- **Deferred.** Enquiry-notification emails to agencies are a `TODO(Phase 5 email)` — not wired to any provider yet. Core browsing and admin work without it.

## Security note
No committed secrets; role checks are enforced in every admin action; uploads and image serving are path-traversal guarded. Just be sure to replace both `change-me` values before deploy.
