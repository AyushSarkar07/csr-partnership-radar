# Deployment Guide (Vercel + Neon + Gemini)

## Current deployment (verified 2026-10-12)
- Production URL: **https://csr-partnership-radar-six.vercel.app** (public)
- Vercel project: `mesa-dbb9/csr-partnership-radar`, framework preset **Next.js**, Node 24, Git-connected to `main`
- Database: Neon `csr-radar-db` (Vercel Marketplace, free plan, region `sin1`), connected to all environments
- Development database: Neon `csr-radar-dev`, connected to the Development environment with prefix `DEV_`
- Cron: `/api/cron/weekly-digest` at `30 0 * * 1` (Monday 06:00 IST)
- Email: Resend (`RESEND_API_KEY`, `DIGEST_FROM_EMAIL=CSR Radar <onboarding@resend.dev>`), recipient set in Settings: ayush10ani@gmail.com
- Mac collector: launchd `com.csrradar.collector` (Mon 05:15 + daily 09:00 IST)

## Fresh setup from scratch
1. **Fork or clone** `https://github.com/AyushSarkar07/csr-partnership-radar`.
2. **Create the Vercel project**: Vercel → Add New → Project → import the repo. **Framework preset: Next.js.** If you create the project from the CLI before any code exists, Vercel may set the preset to "Other", which serves 404s. Fix it under Settings → Build & Deployment.
3. **Add the database**: Project → Storage → Marketplace → **Neon** → create (free) → connect to Production, Preview and Development. This injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. CLI alternative: `vercel integration add neon --name csr-radar-db -m region=sin1`.
4. **Environment variables** (Settings → Environment Variables → Production):

   | Variable | Required | Notes |
   |---|---|---|
   | `GEMINI_API_KEY` | yes | Google AI Studio key. Paste the raw value **without quotes**: a quoted value caused `API_KEY_INVALID` in our first production run |
   | `GEMINI_MODEL` | no | default `gemini-3.8-flash`; must contain `flash` |
   | `ACCESS_CODE` | yes for writes | code typed on /login |
   | `SESSION_SECRET` | yes for writes | `openssl rand -hex 32` |
   | `CRON_SECRET` | yes for cron | `openssl rand -hex 24`; Vercel Cron sends it automatically |
   | `APP_URL` | recommended | public URL used in email links |
   | `MAX_AI_PER_RUN` | no | default 16 |
   | `RESEND_API_KEY`, `DIGEST_FROM_EMAIL` | optional | enable email; then set the recipient and toggle in Settings |

   CLI: `printf '%s' "$VALUE" | vercel env add NAME production`.
5. **Migrate and seed** (from a machine with the env vars, e.g. after `vercel env pull .env.local`):
   ```bash
   npm install
   npm run db:migrate -- --prod   # scripts default to the DEV database; --prod targets production
   npm run db:seed -- --prod
   ```
6. **Deploy**: push to `main` (Git integration) or run `vercel deploy --prod`.
7. **Deployment protection**: for a public URL, use Standard Protection (Settings → Deployment Protection → Vercel Authentication: "Standard"), which leaves the production domain public. The API equivalent is `ssoProtection: { deploymentType: "prod_deployment_urls_and_all_previews" }`.
8. **Verify**:
   ```bash
   curl https://<domain>/api/health                       # ok:true, migrations, gemini.configured
   curl -X POST https://<domain>/api/refresh              # expect 401 without a session
   curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/weekly-digest   # full Monday run
   ```
   Then sign in on `/login`, run **Refresh intelligence**, then **Generate digest now**.

## Operational notes
- **Idempotency:** a second cron call on the same IST date returns `skipped: already_ran` for the refresh and updates, rather than duplicates, the digest, with no second email.
- **Function duration:** a full run took about 37 to 85 seconds in production (13 sources plus up to 16 Gemini calls). The limit is 300 seconds.
- **Source behaviour from Vercel:** NGOBox and FundsForNGOs return 403 to Vercel IPs and GDELT is rate-limited there, so those three carry `config.runner = "local"` and only the Mac collector fetches them. Any failure is isolated per source and listed in the digest.
- **Rollback:** Vercel → Deployments → promote a previous deployment. Database migrations are additive (`create … if not exists`).
- **Rotating secrets:** update the env var and redeploy. Changing `SESSION_SECRET` signs everyone out.
- **Email:** set `RESEND_API_KEY` and `DIGEST_FROM_EMAIL`, then in Settings enable "Email the live digest" and enter the recipient. With the shared test sender `onboarding@resend.dev`, Resend only delivers to the account owner's address (here ayush10ani@gmail.com). Verify a domain at resend.com/domains to send elsewhere. The status becomes `sent` only after Resend returns a message id; a rejected send is stored as `failed` with Resend's reason.
- **Mac collector** (sources that block Vercel IPs):
  ```bash
  scripts/install-mac-collector.sh     # installs + loads ~/Library/LaunchAgents/com.csrradar.collector.plist
  launchctl kickstart gui/$(id -u)/com.csrradar.collector   # run once now
  tail ~/Library/Logs/csr-radar-collector.log
  scripts/uninstall-mac-collector.sh   # remove
  ```
  It needs `.env.local` containing the production `DATABASE_URL` and `GEMINI_API_KEY` (`vercel env pull` provides the database URL).
- **Separate dev database:** `vercel integration add neon --name csr-radar-dev -e development --prefix DEV_` provisions it; `npm run db:migrate && npm run db:seed` (no flag) set it up.
