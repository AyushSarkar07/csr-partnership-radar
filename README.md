# CSR Partnership Radar

**An AI-powered weekly CSR intelligence digest for Ananya, Head of Corporate Partnerships at a Pune-based education & skilling NGO.**

Every Monday morning it answers one question for each development from the past seven days: **is this worth a call this week, and why?**

| | |
|---|---|
| **Live app** | https://csr-partnership-radar-six.vercel.app |
| **Repository** | https://github.com/AyushSarkar07/csr-partnership-radar |
| **Components Map** | [`docs/COMPONENTS_MAP.md`](docs/COMPONENTS_MAP.md) · diagram [`docs/components-map.svg`](docs/components-map.svg) (also served at [/components-map.svg](https://csr-partnership-radar-six.vercel.app/components-map.svg)) |
| **Acceptance report** | [`docs/FINAL_ACCEPTANCE_REPORT.md`](docs/FINAL_ACCEPTANCE_REPORT.md) |

**Open access (owner's decision, 2026-10-12):** there is no sign-in. Anyone with the URL can read everything, including review notes, and can record decisions, change settings, toggle sources, refresh and generate digests. Writes are limited to the app's own origin and expensive actions have cooldowns. The Monday job still requires `CRON_SECRET`.

---

## What it does

1. **Retrieves live data.** It reads public RSS feeds and a news API listed in a source registry: CSR specialist news, business news, an official corporate newsroom, grant/partner-call listings and GDELT.
2. **Normalises, validates and deduplicates deterministically.** HTML becomes text, URLs are canonicalised and publication-date provenance is kept, never faked. A keyword pre-filter runs before any AI call. Deduplication works in three layers: URL, headline similarity, then company + date + initiative.
3. **Classifies with Gemini Flash** (`gemini-3.8-flash`) into schema-validated JSON: sectors, company, initiative, announcement type, explicit-partner-request signal, geographies, funding signal and evidence claims. Each "fact" must quote the source verbatim, and the code checks that the quote really appears in the retrieved text.
4. **Scores each opportunity out of 100 in code.** The weights are sector 25, intent 25, recency 20, geography 15 and evidence 15, all configurable. Each item gets a priority (Call this week / Monitor / Policy / Background / Low), a confidence level, a primary reason, missing information and a next action.
5. **Builds the weekly digest.** It has five sections: high priority, monitor, policy & regulatory, background, and sources that failed. Gemini writes a grounded overview, with a code-generated fallback. The digest is stored in the database, printable, and **emailed through Resend** (once per digest).

Sources that block Vercel's servers (the NGOBox RFP/EOI board and FundsForNGOs) or rate-limit it (GDELT) are fetched by a **Mac-side collector**: a launchd job on Mondays at 05:15 IST and daily at 09:00 IST, running the same pipeline.
6. **Keeps a human decision gate.** Ananya records one of 7 statuses plus notes. Decisions are append-only and never overwritten by reprocessing.
7. **Is configurable.** Sectors, keywords, priorities, operating/expansion/excluded geographies, weights, thresholds, window, timezone, digest options and data mode are all validated and persisted in Postgres.

### Live vs synthetic data

| Badge | Meaning |
|---|---|
| **Verified** | Retrieved from a real source; publication date known; ≥1 claim quoted verbatim from the source. |
| **Needs verification** | Real retrieved item that is unclassified, has an unknown date, or has no verbatim evidence. |
| **Demo** | One of 30 fictional demo records ([`data/seed-opportunities.json`](data/seed-opportunities.json)) using `example.org` URLs. Shown only in **Demo data** mode, which evaluates windows against a fixed reference time (Mon 12 Oct 2026 06:00 IST). Never counted in live metrics or live digests, and never emailed. |

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4) on **Vercel** · **Neon Postgres** (Vercel Marketplace) via `@neondatabase/serverless` · **Gemini Flash** over REST (server-side only) · Vercel Cron · zod · fast-xml-parser · Vitest + PGlite (in-process Postgres) for tests.

The interface is written as product copy and doesn't name the AI vendor or internal tooling. Gemini Flash is the only LLM in the application. The repo has no Claude, OpenAI or other LLM SDK. Claude Code was the development environment only.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL, GEMINI_API_KEY, CRON_SECRET
npm run db:migrate           # apply db/migrations/*.sql
npm run db:seed              # sync source registry + load synthetic demo data
npm run pipeline:refresh     # optional: run the live pipeline once from the CLI
npm run dev                  # http://localhost:3000
```

Scripts act on the **dev database** by default; append `-- --prod` to target production. Other scripts: `npm run collect:local` (cloud-blocked sources), `npm run digest:live`, `npm run digest:demo`, `npm run db:reset-demo`, `npm run test:gemini` (one real Gemini call on a synthetic sample), and `python3 scripts/build-components-map.py` (regenerates the diagram).

## How the pipeline works

```
Vercel Cron (Mon 06:00 IST) / "Refresh intelligence"
  → source adapters (RSS, GDELT) — per-source timeouts & failure isolation
  → normalise + validate → keyword pre-filter + 30-day lookback
  → dedup L1 (canonical URL) / L2 (headline ±3d) → store
  → Gemini Flash classification (≤16 items/run, cached by input hash)
  → excerpt verification → dedup L3 (company+date+initiative) → score
  → digest builder → Gemini overview → digests table → (optional) email
```

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Sources and their access limits: [`docs/DATA_SOURCE_REGISTER.md`](docs/DATA_SOURCE_REGISTER.md).

## Configure Gemini

Set `GEMINI_API_KEY` (server-side) and optionally `GEMINI_MODEL`. The default is `gemini-3.8-flash`, checked against the live `models.list` endpoint on 2026-10-12. The app refuses any model id that doesn't contain `flash`. Without a key, live items stay "awaiting AI analysis" and the digest uses the code-generated overview; nothing is fabricated.

## Test

```bash
npm test            # 114 tests: unit, PGlite integration, route security, end-to-end
npm run lint && npm run typecheck && npm run build
```

The test plan and results are in [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

## Deploy

See [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md). Short version: import the GitHub repo into Vercel (framework **Next.js**), add the Neon integration, set the env vars from `.env.example`, run `npm run db:migrate && npm run db:seed` against the database, and deploy. The cron job is defined in `vercel.json` (`30 0 * * 1` UTC = Monday 06:00 IST).

## Demo workflow (5 minutes)

1. Open the app. **Live data** shows real items collected from the feeds. A quiet week shows few or no high-priority items, and nothing is padded in.
2. Switch to **Demo data**. Orchid Pharma's explicit NGO call ranks first. Open it to see the verified quotes, score breakdown, confidence reasons and next action.
3. Open **Lumen Telecom**: two publications, merged into one opportunity with two sources. Then open **Kestrel Digital**: the same company's tree-planting announcement is kept separate and ranked Low.
4. Filter by **Evidence: weak**. Zenith Retail and Crestline Finance have "facts" whose quotes don't appear in the source, so they are flagged and downgraded.
5. Set a decision with a note and reload: the decision persists with its history.
6. Click **Generate demo digest now** to see the five sections, the Gemini overview and the honest delivery status ("not emailed").
7. In **Settings**, add a sector or change a weight and save. Scores update everywhere after reload.
8. **Sources** shows each feed's last success or error, robots.txt and 403 findings, and the per-run filter counts.

## Repository map

```
src/app/            pages (dashboard, opportunity detail, digest, sources, settings, status) + API routes
src/lib/sources/    registry + adapters (rss.ts, gdelt.ts) + bounded HTTP
src/lib/pipeline/   normalise/validate/pre-filter (normalize.ts), ingest + dedup + AI orchestration (ingest.ts)
src/lib/ai/         Gemini client (gemini.ts), classification prompt & grounding (classify.ts), schema (analysis.ts)
src/lib/scoring/    deterministic 100-point scoring
src/lib/digest/     digest sections (build.ts), generation/idempotency/delivery (generate.ts)
src/lib/delivery/   optional Resend email
src/lib/time/       single reporting-window definition (Asia/Kolkata)
db/migrations/      SQL schema     data/   source registry + synthetic seed     tests/   Vitest suites
docs/               spec, assumptions, sources, architecture, tests, deployment, components map, reports
```
