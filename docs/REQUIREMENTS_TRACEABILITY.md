# Requirements Traceability — CSR Partnership Radar

Source documents:
- **PDF** — `Problem Statement 9-2.pdf` (MESA Cohort C4, Section 1 Final Examination, "CSR Partnership Radar"). Authoritative.
- **BRIEF** — the build brief and execution protocol supplied with the task (implementation guidance; elaborates the PDF).

Status vocabulary: `NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED` (code exists) · `IMPLEMENTED-UNVERIFIED` (code exists, could not be exercised) · `VERIFIED` (test or observation recorded below) · `BLOCKED`.

> This file was created before application code was written (status `NOT STARTED` everywhere) and is updated at each checkpoint. The final state is mirrored in `docs/FINAL_ACCEPTANCE_REPORT.md`.

## A. Release-blocking requirements (from the PDF)

| ID | Requirement | Type | Component | Implementation | Verification | Status | Evidence |
|---|---|---|---|---|---|---|---|
| PDF-1 | Use live external data wherever possible; system must work with some data at submission | Mandatory | Source adapters + ingestion pipeline | _planned:_ `src/lib/sources/*`, `src/lib/pipeline/ingest.ts`, `POST /api/refresh` | Run a real fetch, inspect rows in `announcement_sources` with real URLs | NOT STARTED | |
| PDF-2 | All AI tasks use Gemini Flash; no Claude API | Mandatory | Gemini client | _planned:_ `src/lib/ai/gemini.ts`, model id in `src/lib/config.ts` | Real Gemini call; grep repo for other LLM SDKs | NOT STARTED | |
| PDF-3 | Deploy on Vercel; working public URL | Mandatory | Vercel project | _planned:_ `vercel.json`, production deploy | Open production URL, exercise critical flows | NOT STARTED | |
| PDF-4 | GitHub repository link | Mandatory | Git repo | _planned:_ public GitHub repo | `gh repo view`, commit visible | NOT STARTED | |
| PDF-5 | Components Map | Mandatory | Docs | _planned:_ `docs/COMPONENTS_MAP.md`, `docs/components-map.svg` | Every node cross-checked to a file | NOT STARTED | |

## B. Functional requirements (from the PDF)

| ID | Requirement | Type | Component | Implementation | Verification | Status | Evidence |
|---|---|---|---|---|---|---|---|
| PDF-6 | Weekly CSR intelligence digest | Mandatory | Digest generator | _planned:_ `src/lib/digest/*`, `/digest` | Generate digest, reload | NOT STARTED | |
| PDF-7 | Covers sectors: education, skill development, digital literacy, youth employment | Mandatory | Settings defaults + classifier | _planned:_ `src/lib/settings.ts`, Gemini schema | Unit tests on sector scoring | NOT STARTED | |
| PDF-8 | Surfaces every significant development from the past seven days | Mandatory | Window logic | _planned:_ `src/lib/time/window.ts` used everywhere | Boundary tests | NOT STARTED | |
| PDF-9a | New CSR initiatives in focus areas | Mandatory | Classifier category `new_initiative` | Gemini + scoring | Scenario tests | NOT STARTED | |
| PDF-9b | Firms signalling increased allocation (press / annual report) | Mandatory | Category `increased_allocation` | Gemini + scoring | Scenario tests | NOT STARTED | |
| PDF-9c | Corporates explicitly searching for NGO implementation partners | Mandatory | Category `explicit_partner_request` + `implementation_partner_signal` | Gemini + scoring | Tests 2, 3 | NOT STARTED | |
| PDF-9d | Policy / regulatory changes affecting CSR deployment | Mandatory | Category `policy_change`, digest policy section | Gemini + digest | Scenario test | NOT STARTED | |
| PDF-10 | Not a raw headline feed; each item answers "is this worth a call this week?" | Mandatory | Score + verdict + next action | _planned:_ `src/lib/scoring/*`, opportunity cards | UI inspection; digest payload test | NOT STARTED | |
| PDF-11 | Focus sectors configurable | Mandatory | Settings | `/settings`, `user_settings` table | Test 13 | NOT STARTED | |
| PDF-12 | Geographic priorities configurable | Mandatory | Settings | `/settings`, geo scoring | Test 5, 13 | NOT STARTED | |
| PDF-13 | Delivered every Monday morning before outreach week | Mandatory | Vercel Cron | _planned:_ `vercel.json` cron, `/api/cron/weekly-digest` | Protected-route test; production cron config visible | NOT STARTED | |
| PDF-14 | AI-powered | Mandatory | Gemini classification + digest synthesis | as PDF-2 | as PDF-2 | NOT STARTED | |

## C. Brief requirements (implementation guidance)

| ID | Requirement | Type | Implementation (planned) | Verification | Status | Evidence |
|---|---|---|---|---|---|---|
| BR-1 | Pipeline: discovery→fetch→normalise→validate→dedupe→filter→classify→score→summarise→review→digest | Brief | `src/lib/pipeline/*` | Integration test with fixtures | NOT STARTED | |
| BR-2 | Configurable source registry with name, type, URL, sectors, geo, method, official flag, last success, last error, enabled, limitations | Brief | `data/sources.json`, `sources` table, `/sources` | Inspect table; source test | NOT STARTED | |
| BR-3 | Reusable source adapters | Brief | `src/lib/sources/adapters/*` | Unit tests | NOT STARTED | |
| BR-4 | Respect robots.txt / terms; no paywall/login bypass | Brief | Registry records robots findings; disabled sources | Doc review | NOT STARTED | |
| BR-5 | Provenance per item (URL, publisher, headline, pub date, retrieval ts, text, entities, sectors, geo, source type, excerpts, status) | Brief | `announcement_sources`, `announcements` | DB inspection | NOT STARTED | |
| BR-6 | Show last-checked time; distinguish publication vs retrieval date; unknown dates labelled | Brief | Dashboard + detail | Test 8 + UI | NOT STARTED | |
| BR-7 | Seven-day window, Asia/Kolkata, one shared definition; exploratory windows selectable | Brief | `src/lib/time/window.ts` | Unit tests | NOT STARTED | |
| BR-8 | Layered dedup (canonical URL, headline similarity, entity, date) grouping supporting sources | Brief | `src/lib/pipeline/dedupe.ts` | Test 7 | NOT STARTED | |
| BR-9 | Seed dataset 24–36 synthetic records covering 16 scenarios, fully labelled | Brief | `data/seed-opportunities.json`, `scripts/seed.ts` | Seed test | NOT STARTED | |
| BR-10 | Live / live-unverified / synthetic separation; synthetic never in live digest | Brief | `data_origin` column, mode switch | Test 12 | NOT STARTED | |
| BR-11 | 100-point configurable, explainable score (25/25/20/15/15) | Brief | `src/lib/scoring/score.ts` | Unit tests | NOT STARTED | |
| BR-12 | Each opportunity shows total, breakdown, primary reason, evidence, missing info, next action, confidence, source quality, freshness | Brief | Card + detail | UI + unit | NOT STARTED | |
| BR-13 | Human review statuses (7) + notes, persisted, never overwritten by reprocessing | Brief | `opportunity_reviews` (append-only) | Test 14 | NOT STARTED | |
| BR-14 | Gemini structured output, validation, retries with bounded backoff, timeouts, missing key handling | Brief | `src/lib/ai/gemini.ts` | Test 11 | NOT STARTED | |
| BR-15 | Evidence-grounded summaries: facts vs interpretation vs unknown; excerpt per claim | Brief | `evidence_claims` + excerpt verification | Test 17 | NOT STARTED | |
| BR-16 | Prompt-injection defence for retrieved content | Brief | Prompt framing + sanitisation | Unit test | NOT STARTED | |
| BR-17 | Cost control: deterministic code for dates/dedup/scoring; cache classification | Brief | content_hash cache | Unit test | NOT STARTED | |
| BR-18 | Digest sections: high priority, monitor, policy, background, failed sources; no padding | Brief | `src/lib/digest/build.ts` | Unit test | NOT STARTED | |
| BR-19 | Scheduled workflow idempotent; manual "Refresh intelligence" and "Generate digest now" | Brief | run keys, digest keys | Test 15 | NOT STARTED | |
| BR-20 | Optional email delivery; honest delivery status | Brief | `src/lib/delivery/email.ts` | Unit test | NOT STARTED | |
| BR-21 | Protected scheduled / privileged endpoints | Brief | `src/lib/auth.ts` | Test 16 | NOT STARTED | |
| BR-22 | Dashboard metrics computed from data; source health; live vs synthetic indicator | Brief | `/` | Integration test | NOT STARTED | |
| BR-23 | Filters: window, sector, company, geography, type, priority, evidence, source type, status, origin; sorting | Brief | `GET /api/opportunities` + filter bar | Integration test | NOT STARTED | |
| BR-24 | Detail view: summary, evidence, links, entities, breakdown, AI interpretation, uncertainties, action, notes, history, related coverage | Brief | `/opportunities/[id]` | UI | NOT STARTED | |
| BR-25 | Settings page persisted & validated (sectors, geos, programmes, weights, window, sources, schedule, email, data mode) | Brief | `/settings`, `PUT /api/settings` | Test 13 | NOT STARTED | |
| BR-26 | Persistent DB with migrations, FKs, indexes | Brief | `db/migrations/*.sql`, `scripts/migrate.ts` | Migration test on PGlite + Neon | NOT STARTED | |
| BR-27 | API boundaries (opportunities, refresh, digest, sources, health, cron) | Brief | `src/app/api/*` | Integration tests | NOT STARTED | |
| BR-28 | First-run status screen, demo/live mode | Brief | `/status` | UI | NOT STARTED | |
| BR-29 | Tests 1–18 | Brief | `tests/*` | `npm test` | NOT STARTED | |
| BR-30 | Docs: README, .env.example, PRODUCT_SPEC, ASSUMPTIONS, DATA_SOURCE_REGISTER, ARCHITECTURE, TEST_PLAN, DEPLOYMENT_GUIDE, COMPONENTS_MAP | Brief | `docs/*` | File review | NOT STARTED | |
| BR-31 | Security: server-only secrets, .env ignored, validated bodies, rate limits, no untrusted HTML, no arbitrary URL fetch, bounded timeouts/retries | Brief | various | Test 16 + review | NOT STARTED | |
| BR-32 | UI polish: responsive, loading/empty/error states, accessible labels | Brief | components | Browser check | NOT STARTED | |
| BR-33 | Final acceptance report | Brief | `docs/FINAL_ACCEPTANCE_REPORT.md` | — | NOT STARTED | |
