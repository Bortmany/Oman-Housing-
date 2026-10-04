# Go-Live checklist — Oman Property Intelligence (Oman-Housing-)

Plain-English list of what to set up before launch. Full context: `Agents/docs/go-live-and-security-audit.md`.

## Do these in this order (every new owner step)
1. Database, `AUTH_SECRET`, `AUTH_URL`, `TRUST_PROXY_HEADERS` (Must do list below).
2. Attach the `/data` volume and set `DATA_DIR=/data` — before anyone uploads a photo.
3. Twilio (phone codes) — private owners cannot list until this is set.
4. Resend (`RESEND_API_KEY` + `EMAIL_FROM`) — alert emails.
5. `CRON_SECRET`, then the two Railway crons (hourly alerts, daily averages).
6. Protomaps map on Cloudflare R2 (`NEXT_PUBLIC_MAP_PMTILES_URL`) before real traffic.
7. Plausible visitor stats (optional) — the privacy page updates itself.
8. `REDIS_URL` — not needed until the shared limit store is built (see note under Twilio).
9. Take a first backup of the database AND the `/data/properties` folder, and practise restoring both.

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
- [ ] **Set `AUTH_URL`** to the real public web address. It also drives the sitemap (`/sitemap.xml`), `robots.txt`, the language links and the share-preview links and images. If it is missing in production, the sitemap is left empty and no share links are published (the site still works). After launch, open `/sitemap.xml` and `/robots.txt` once and check they show your real address. Note: `robots.txt` is a polite request to search engines, not security; the real protection of admin and agency pages is the login check.
- [ ] **Share-preview image**: `public/og-default.jpg` (1200x630) is the picture shown when a page without its own photo is shared. Replace it with the final artwork if wanted. Sample (demo) properties are kept out of search results and the sitemap on purpose; they still open by direct link.
- [ ] **Attach a persistent Volume at `/data`** and set `DATA_DIR=/data`. Uploaded property photos are stored here — without the volume they are wiped on every redeploy.
  **Do this BEFORE any real owner or agency uploads a photo.** Private owners and agencies now upload up to 15 photos per listing (5 MB each), so this is where those pictures live. The `/data` volume is a **single copy** and is **not** covered by the database backup: if it is missing or lost, every photo is gone while the listings stay. Plain-English copy-out: on a regular schedule (and before any risky change) copy the whole `/data/properties` folder somewhere else (Railway's volume backup, or download it) and keep the copy with your database backup; to restore, put the folder back at `/data/properties`. Do one practice restore before launch.
- [ ] **Owner listings stay closed in production until the SMS service is keyed** (see the Twilio step) — a private owner must verify an Omani phone first. Existing invite codes already cover owner sign-up (owners are ordinary accounts). Every owner listing is reviewed by you in `/admin/review` before it appears; the first one from a new owner is flagged.
- [ ] **Set a strong `SEED_ADMIN_PASSWORD`** *before* seeding — it becomes the password for both `admin@example.com` and `agency@example.com`. Then remove or rotate those demo accounts before going public.
- [ ] **Have the legal pages reviewed** — the Privacy Policy (`/privacy`) and Terms of Use (`/terms`) are plain-language templates, not legal advice; have both professionally reviewed by a lawyer in Oman. The contact address on both pages defaults to the owner's own (`naeljam@hotmail.com`); to show a different one, set `PRIVACY_CONTACT_EMAIL` (see Optional below).
- [ ] **Set `SIGNUP_INVITE_CODES` before launch** — a comma-separated list of invite codes, each 8+ characters (e.g. `muscat-2026-alpha,salalah-2026-beta`). Both sign-up forms (buyer register and agency list-with-us) then ask for a code. Without it, production sign-up is **closed** to everyone (the safe default). Rotate or revoke a code by editing the variable and redeploying. When payments exist and you want everyone in, set `SIGNUPS_OPEN="true"`. A signed-in admin can confirm the mode at `/api/health` (`signups: open | invite | closed`).
- [ ] **Set `TRUST_PROXY_HEADERS="true"` on Railway.** Railway's edge network overwrites `X-Forwarded-For` itself, so this is safe there and turns on real per-visitor-IP rate limiting for login/signup. Without it, the app falls back to a per-browser cookie for anonymous rate limiting (still safe, but weaker — see `.env.example`), and logs a warning in production every time it starts.
- [ ] **Switch on the Protomaps map before real traffic** — the map uses the free OpenStreetMap tile server by default, which is for light use only and can block or throttle a busy site. The chosen replacement is Protomaps: one Oman map file on Cloudflare R2 (about $0–15/month). Steps: (1) create a Cloudflare R2 bucket and attach a custom domain to it (for example `tiles.<your domain>`); (2) set the bucket's CORS to allow GET and HEAD from the site's address, allow the `Range` request header, and expose the `ETag` header; (3) cut an Oman extract from the Protomaps world build with the `pmtiles extract` command, bounding box about `51.5,16.4,60.0,26.5` (west, south, east, north); (4) upload the `.pmtiles` file to the bucket; (5) set `NEXT_PUBLIC_MAP_PMTILES_URL` to the file's public address and redeploy (it is a build-time variable, so it only takes effect on a new build). Refresh the file a few times a year. Fonts and icons are already inside the app (`public/map`). The security headers pick up the new address automatically. If the variable is left unset, the map keeps using `NEXT_PUBLIC_MAP_TILE_URL` (OpenStreetMap by default).

## Optional
- [ ] `ANTHROPIC_API_KEY` — turns on the AI property analyst. Without it, the analyst card shows a "not switched on" message; everything else works.
- [ ] **Cloudflare Turnstile (free CAPTCHA)** — `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Create a free Cloudflare account, open Turnstile → Add site, enter the app's domain, and copy the site key and secret key. Once BOTH are set, a "verify you're human" box appears on the login, register and list-with-us forms and every submission is checked. Until then it's dormant — no box, no checks. Signed-in admins can confirm it at `/api/health` (`captcha: configured`).
- [ ] **Visitor stats (Plausible, about $9/month, no cookies)** — `NEXT_PUBLIC_STATS_SCRIPT_URL` + `NEXT_PUBLIC_STATS_SITE_ID` (+ `NEXT_PUBLIC_STATS_ATTR=data-domain`). Steps: (1) sign up at plausible.io (30-day trial, no card); (2) Add a site and enter the live domain exactly as visitors see it; (3) copy the script address from the snippet (normally `https://plausible.io/js/script.js`); (4) on Railway set `NEXT_PUBLIC_STATS_SCRIPT_URL` to that address, `NEXT_PUBLIC_STATS_SITE_ID` to the domain, and `NEXT_PUBLIC_STATS_ATTR` to `data-domain`, then redeploy (these are read when the site is built, so a redeploy is needed); (5) visit the live site once, then click Verify installation in Plausible. Dormant until both of the first two are set — no script, no change to the page. Signed-in admins can confirm it at `/api/health` (`stats: configured`). When on, the privacy page automatically gains a visitor-statistics line. Check Plausible's own data page still matches that line (no cookies, no personal identification) before launch.
- [ ] `SENTRY_DSN` — error alerts. Empty = off.
- [ ] `PRIVACY_CONTACT_EMAIL` — the contact address shown as a mailto link on the Privacy Policy and Terms of Use pages. Leave unset to use the owner's address (`naeljam@hotmail.com`).
- **Password reset is not built.** The site is invitation-only for now; the owner resets a forgotten password by hand from the database.
- [ ] `NEXT_PUBLIC_MAP_PMTILES_URL` — see "Switch on the Protomaps map" under **Must do** above; treat it as required once real visitors arrive. `NEXT_PUBLIC_MAP_TILE_URL` is only the fallback used while it is unset.

## Phone codes for private owners (Twilio)
- [ ] **Needed before private owners can list.** Without it, in production, the "Verify your phone" page tells owners the service isn't switched on yet and owner listing stays closed. Nothing else breaks.
  1. Create an account at [twilio.com](https://www.twilio.com) and add billing credit (each text costs a few cents; the site allows 3 texts an hour per person and per number, and Omani mobiles only).
  2. In the Twilio console open **Verify, then Services, then Create new**, name it after the site, and copy its **Service SID** (starts `VA`).
  3. From the console home copy the **Account SID** (starts `AC`) and the **Auth Token**.
  4. Set all three on Railway: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. Dormant until all three are present.
  5. Check Twilio is allowed to text Oman numbers (messaging geo-permissions in the console) and test with your own mobile from the Account page. A signed-in admin sees `sms: configured` at `/api/health`.
- The privacy page and terms already say the number goes to an SMS provider (Twilio) and is shown on the owner's own listings.

- **About `REDIS_URL` (be aware):** the shared limit store is NOT wired up yet — setting `REDIS_URL` today only makes the app log a warning. Until it is built, every limit (including the text-sending ones: 3 an hour per person, 10 an hour per network address) is counted separately by each server copy. That is fine while you run ONE copy on Railway; do not add a second copy until the shared store is built.

## Payments
- **Thawani / PayTabs checkout is deferred (not built).** For now you grant Premium/Business tiers by hand from `/admin/agencies`. Stripe is not an option (it doesn't serve Oman merchants).

## Email
- **The wiring exists, switched off.** `src/lib/email/send.ts` sends through [Resend](https://resend.com)'s API with no extra software installed. It stays completely inert — nothing sent, nothing broken — until BOTH of these are set:
  - `RESEND_API_KEY` — the API key from your Resend account.
  - `EMAIL_FROM` — the "from" address, e.g. `"Oman Property Intelligence <alerts@yourdomain.com>"`. The domain has to be verified in Resend first.
- **What wakes up when you set them:** saved-search alert emails (see "Alert job" below). Until then the account page and the "Save this search" button say plainly, in both languages, that alerts start once the email service is connected. The agency enquiry notification is still not built (`TODO(Phase 5 email)`). Core browsing and admin work without any of it.
- A signed-in admin sees `email: configured | outbox | dormant` and `alertJob: configured | dormant` at `/api/health`.

## Alert job
Sends each person an email when new listings match a saved search ("as soon as they appear" or "once a day", as they chose). Built in `src/lib/alerts/`; the address is `POST /api/jobs/saved-search-alerts`.
- [ ] **Set `CRON_SECRET`** on Railway — a long random value, e.g. `openssl rand -base64 32` (at least 16 characters). Unset or too short = the job address refuses everyone (503), so it can never run open.
- [ ] **Set `RESEND_API_KEY` and `EMAIL_FROM`** (domain verified in Resend). Without them the job reports "not configured", writes a note per search at most once a day, and does NOT mark anything as alerted — so nothing is lost; alerts start flowing once the keys arrive. Check your Resend plan's daily send limit; the job itself sends at most 100 emails per run and 10 per person per 24 hours.
- [ ] **Add an hourly Railway cron** that runs: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$AUTH_URL/api/jobs/saved-search-alerts"` (schedule `0 * * * *`). Make sure `AUTH_URL` is the real public address — it is also used for the links inside the emails.
- Safe to run twice at once: each alert is claimed once, so nobody gets a duplicate. If a send fails, the next hourly run retries it. If the server crashes at the worst moment, at most one email can be lost — it is never sent twice.
- `EMAIL_DEV_LOG=true` is for LOCAL testing only: emails are written as `.eml` files in `DATA_DIR/outbox/` instead of being sent, and it is ignored in production. Those files are throw-away test output and need no backup.
- `AlertLog` (who / which search / how many / result — never the email text) lives in the database, so it is covered by the normal database backup. The job deletes rows older than 90 days.

## Daily averages job
Works out average prices from live listings. Address: `POST /api/jobs/listing-averages`.
- [ ] **Add a daily Railway cron** that runs: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$AUTH_URL/api/jobs/listing-averages"` (schedule `0 23 * * *` = 03:00 Oman time). It uses the same `CRON_SECRET` as the alert job. The admin "Recompute now" button on the market-stats page does the same thing by hand and needs no secret.
- It only writes figures into the database (covered by the normal database backup); nothing else to copy out.

## Backups and restoring (plain English)
- **Database:** in the Railway dashboard open the Postgres service, switch automatic backups ON and look at the list to confirm a backup really exists (do not assume). To restore: create a scratch database, load the backup into it, then check the tables for users, listings, market figures and saved searches look right. Never practise on the live database. Repeat the practice every 90 days.
- **Photos (`/data/properties`):** the only copy of every owner and agency photo. It is NOT in the database backup. Copy the folder out regularly (see the volume step above) and keep it next to the database backup. To restore, put the folder back at `/data/properties`.
- **Alert log (`AlertLog`):** in the database, so the database backup covers it; rows older than 90 days are deleted on purpose.
- **Outbox (`/data/outbox`):** test emails from local development only. Throw-away — never back it up, never restore it.

## Security note
No committed secrets; role checks are enforced in every admin action; uploads and image serving are path-traversal guarded. Just be sure to replace both `change-me` values before deploy.
