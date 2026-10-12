# Architecture

## Overview
A single Next.js 16 application (App Router, TypeScript) deployed on Vercel. Pages are server components that read Postgres directly through `src/lib/*`, and small client components call JSON API routes for mutations. There is no separate worker: scheduled work runs in a Vercel Function triggered by Vercel Cron, with `maxDuration` of 300 seconds.

```
Browser ──► Next.js pages (server components) ──► src/lib (queries, scoring) ──► Neon Postgres
   │                                                    ▲
   └── client components ──► /api/* route handlers ─────┤
Vercel Cron ──► /api/cron/weekly-digest ──► pipeline + digest ──► Gemini Flash (REST)
                                         └► RSS feeds / HTML listing (HTTPS GET)
Mac launchd ──► scripts/collect-local.ts --prod ──► same pipeline for cloud-blocked sources ──► Neon (prod)
```

## Module boundaries
| Concern | Module | Notes |
|---|---|---|
| Configuration | `src/lib/config.ts`, `src/lib/settings/*` | Env access, limits, Gemini model guard; zod-validated settings persisted in `user_settings` |
| Database access | `src/lib/db/*` | `Db` interface (query + tx). Neon `Pool` in production, PGlite in tests. SQL migrations in `db/migrations` |
| Source adapters | `src/lib/sources/adapters/{rss,gdelt}.ts`, `http.ts`, `registry.ts` | Pure parsing functions plus bounded fetch. The registry file is synced to the DB |
| Normalisation & validation | `src/lib/pipeline/normalize.ts`, `src/lib/text.ts` | HTML→text, entity decoding, canonical URLs, date parsing, keyword pre-filter |
| Dedup & orchestration | `src/lib/pipeline/ingest.ts` | Run lifecycle, per-source isolation, L1/L2/L3 dedup, AI budget, saving analysis |
| AI classification | `src/lib/ai/{gemini,classify,analysis}.ts` | REST client with retries and timeouts, prompt construction, zod schema, excerpt verification |
| Scoring | `src/lib/scoring/score.ts` | Pure function: inputs + settings + window → score, priority, confidence, reasons |
| Reporting window | `src/lib/time/window.ts` | The single window definition and IST formatting |
| Read models | `src/lib/repo/{opportunities,filters}.ts`, `src/lib/queries.ts` | Load announcements with coverage, claims and latest review; score at read time; filter and sort |
| Digest | `src/lib/digest/{build,generate}.ts` | Sections, Gemini overview with fallback, idempotent upsert, atomic delivery claim |
| Delivery | `src/lib/delivery/email.ts` | Escaped HTML/text email template; Resend call with idempotency key |
| Access control | `src/lib/auth.ts`, `src/lib/ratelimit.ts` | Same-origin check on mutations, cron bearer, DB-backed cooldowns (no user sign-in) |
| UI | `src/app/*`, `src/components/*` | Tailwind v4 with design tokens and light/dark themes |

## Data model (Postgres)
```
sources ─┐
         ├─< announcement_sources >── announcements ──< evidence_claims
fetch_runs┘                              │  │  └──< opportunity_reviews (append-only)
                                         │  └──── opportunity_scores (snapshot)
companies ───────────────────────────────┘
digests ──< digest_items >── announcements
user_settings (single row) · audit_events · rate_limits · schema_migrations
```
- `announcements` holds the primary opportunity record, one per real-world event: `data_origin` (live/synthetic), `verification_status`, `published_at` (nullable) with `published_at_provenance`, AI status/model/error/attempts/input hash, classification columns and the full validated `analysis` JSON.
- `announcement_sources` holds each retrieved item, with a unique `canonical_url`, publisher, its own publication and retrieval timestamps, excerpt, raw text and a snapshot of credibility and the official flag. Duplicates attach here with `is_primary = false`.
- `evidence_claims` stores each claim with kind (fact/interpretation/unknown), the excerpt, `excerpt_verified` and an FK to the coverage row.
- `digests` is unique on `digest_key` (`<mode>:<IST date>`) and stores `generation_count`, summary source, delivery status, channel and message id. `digest_items` is unique on `(digest_id, announcement_id)`.
- Indexes cover origin + publication date, company, type, AI status and GIN on sectors.

## Key flows
**Refresh** (`runRefresh`):
1. Create a `fetch_runs` row. Scheduled runs use a unique `run_key`, so a repeat is skipped.
2. Fetch every enabled source concurrently; record per-source outcomes.
3. Normalise, validate, drop in-feed duplicates, apply the 30-day lookback, keyword pre-filter.
4. L1 dedup against stored canonical URLs. L2 clusters near-identical headlines within ±3 days as supporting coverage.
5. Classify pending items with Gemini (≤16 per run, 3 concurrent). A missing key leaves items pending; rate limits stop the batch; other errors mark the item failed (≤3 attempts).
6. Verify excerpts, save the analysis and claims, upsert the company, then L3 merge (same company + date ±4 days + overlapping headline or initiative). Reviews and claims move with the merge.
7. Re-score all live records with the current settings, persist score snapshots, finalise the run, write an audit event.

**Scoring at read time**: the dashboard, detail view and digest always score with the current settings and window, so a settings change takes effect immediately. Snapshots in `opportunity_scores` record what was computed for each run or digest.

**Digest** (`generateDigest`): window end is now (live) or the fixed demo reference time. Items are built from scored opportunities, excluding those reviewed "not relevant" or "won/closed". The Gemini overview is generated only from item JSON and validated; top actions that reference unknown ids are dropped, and failures fall back to a code summary with the error recorded. The digest row is upserted in a transaction and its items replaced. Delivery: demo is never emailed; live is emailed only if configured, and an atomic `UPDATE … WHERE delivery_status NOT IN ('sent','pending')` claim prevents double sends.

## Vercel specifics
- Functions run on Node.js (Fluid compute). Refresh and cron use `maxDuration = 300`, digest generation 120.
- Cron: `vercel.json` → `30 0 * * 1`. Vercel sends `Authorization: Bearer $CRON_SECRET`. Hobby plan allows daily-or-less-frequent schedules with hour-level precision.
- Database: Neon serverless driver over WebSockets (`Pool`) with a small pool and an error handler for idle drops.
- Deployment protection: standard. The production domain is public; preview deployments require Vercel login.

## Security posture
Server-only secrets; `.env*` git-ignored except `.env.example`. **No user sign-in** (owner's decision): reads and writes are open. Every mutation must come from the app's own origin (cross-origin requests get 403), and the scheduled job requires `CRON_SECRET`. Bodies are validated with zod, JSON content type is required and size is capped. Refresh has a 120-second cooldown and digests 20 seconds. Retrieved HTML is never rendered: it is converted to text, links get `rel="noopener noreferrer nofollow"`, and email HTML is escaped with http(s)-only links. Error messages are sanitised, with no stack traces, connection strings or keys. Retrieved text is framed as untrusted for Gemini, closing-tag injection is stripped, and `injection_detected` is surfaced. Security headers: `nosniff`, `X-Frame-Options: DENY`, referrer policy.

**Database per environment:** `src/lib/db/url.ts` picks `DATABASE_URL` on Vercel production and `DEV_DATABASE_URL` locally. SQL `date` columns are returned as `YYYY-MM-DD` strings, so deadlines don't shift with the server timezone.

**Known limitations:** no authentication, so anyone with the URL can change settings or decisions and trigger Gemini usage (within cooldowns); requests without an Origin header (e.g. curl) are accepted; cloud-blocked sources depend on the Mac collector running.
