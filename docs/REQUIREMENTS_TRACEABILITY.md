# Requirements Traceability — CSR Partnership Radar

Source documents:
- **PDF**: `Problem Statement 9-2.pdf` (MESA Cohort C4, Section 1 Final Examination, "CSR Partnership Radar"). Authoritative.
- **BRIEF**: the build brief and execution protocol supplied with the task (implementation guidance that elaborates the PDF).

Status vocabulary: `NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED` (code exists) · `IMPLEMENTED-UNVERIFIED` (code exists, not exercised for real) · `VERIFIED` (test or observation recorded) · `BLOCKED`.

History: created before any application code, with every row `NOT STARTED`. Updated at the end of the build, 2026-10-12. Test names refer to `tests/*.test.ts`; "prod" means observed on https://csr-partnership-radar-six.vercel.app.

## A. Release-blocking requirements (PDF instructions)
| ID | Requirement | Type | Implementation | Verification | Status | Evidence |
|---|---|---|---|---|---|---|
| PDF-1 | Use live external data wherever possible; work with some data at submission | Mandatory | 11 enabled real sources (`data/sources.json`), adapters `src/lib/sources/adapters/*`, `runRefresh()`, `POST /api/refresh`, cron | Real fetch, inspect stored rows | **VERIFIED** | CLI run: 190 items, 24 new live announcements stored with real URLs; prod cron run 175 items; prod `/api/health` → `records.live: 29` |
| PDF-2 | All AI tasks use Gemini Flash; no Claude API | Mandatory | `src/lib/ai/gemini.ts` (REST), model guard in `src/lib/config.ts` (`gemini-3.8-flash`, rejects non-Flash) | Real calls; grep for other SDKs | **VERIFIED** | `scripts/smoke-gemini.ts` live call; `docs/GEMINI_EVAL.md` (30 real calls); prod refresh classified 8 items, digest `summary_source: gemini`; `package.json` has no LLM SDK; `gemini.test.ts` model guard |
| PDF-3 | Deploy on Vercel; working public URL | Mandatory | Vercel project `mesa-dbb9/csr-partnership-radar`, Git-connected | Open URL, exercise flows | **VERIFIED** | https://csr-partnership-radar-six.vercel.app: all pages 200 without login; health ok; login, refresh, digest and settings exercised via API in prod |
| PDF-4 | GitHub repository link | Mandatory | https://github.com/AyushSarkar07/csr-partnership-radar (public) | `gh repo view`, commits pushed | **VERIFIED** | `main` pushed; Vercel deploys from it |
| PDF-5 | Components Map | Mandatory | `docs/COMPONENTS_MAP.md`, `docs/components-map.svg` (+ `/components-map.svg`), generator script | Each node mapped to a file | **VERIFIED** | Node→file table in COMPONENTS_MAP.md; diagram rendered and reviewed |

## B. Functional requirements (PDF problem statement)
| ID | Requirement | Type | Implementation | Verification | Status | Evidence |
|---|---|---|---|---|---|---|
| PDF-6 | Weekly CSR intelligence digest | Mandatory | `src/lib/digest/*`, `/digest`, `digests`/`digest_items` | Generate and reload | **VERIFIED** | `digest.test.ts`; prod digest `live:2026-10-12` |
| PDF-7 | Covers education, skill development, digital literacy, youth employment | Mandatory | `DEFAULT_SETTINGS.sectors`, Gemini schema enum built from settings | Unit + eval | **VERIFIED** | `scoring.test.ts`, `gemini.test.ts` (sectors restricted to configured keys) |
| PDF-8 | Every significant development from the past seven days | Mandatory | `src/lib/time/window.ts` shared by pipeline, dashboard, filters, digest | Boundary tests | **VERIFIED** | `window.test.ts` (6 cases); digest window (Oct 5 06:00 → Oct 12 06:00 IST) |
| PDF-9a | New CSR initiatives in focus areas | Mandatory | `announcement_type = new_initiative`, intent 0.76 | Scenario + eval | **VERIFIED** | SYN-001/002/003 high; Gemini eval matches |
| PDF-9b | Increased allocation via press / annual report | Mandatory | `increased_allocation`, funding signal | Scenario + eval | **VERIFIED** | SYN-005 high, SYN-024 weak → monitor; eval 2/2 |
| PDF-9c | Explicit search for NGO implementation partners | Mandatory | `explicit_partner_request` + `implementation_partner_signal.level`, intent 1.0, badge "Seeking NGO partners" | Tests 2, 3 | **VERIFIED** | `pipeline.test.ts`, `scoring.test.ts`, eval 30/30 partner safety |
| PDF-9d | Policy / regulatory changes affecting CSR deployment | Mandatory | `policy_change`, `policy_implication {confirmed / needs_interpretation}`, digest policy section | Scenario | **VERIFIED** | SYN-013/022 → policy section; SYN-023 stale → background (`digest.test.ts`) |
| PDF-10 | Not a raw feed; each item answers "worth a call this week?" | Mandatory | Verdict, primary reason, breakdown, intent evidence, uncertainties, next action on cards, detail and digest | UI + payload test | **VERIFIED** | `digest.test.ts` checks every item has sources, next action, 5-part breakdown; UI screenshots |
| PDF-11 | Focus sectors configurable | Mandatory | `/settings` sector editor → `PUT /api/settings` → `user_settings` | Test 13 | **VERIFIED** | `settings-e2e.test.ts`; prod PUT → version 1 persisted |
| PDF-12 | Geographic priorities configurable | Mandatory | Operating, expansion and excluded geographies; `geographicFit()` | Tests 5, 13 | **VERIFIED** | `scoring.test.ts` › "changing configured geography changes the fit" |
| PDF-13 | Delivered every Monday morning | Mandatory | `vercel.json` cron `30 0 * * 1`; `/api/cron/weekly-digest` | Route invoked in prod; cron registered | **VERIFIED** (route) / **IMPLEMENTED-UNVERIFIED** (first unattended trigger) | Prod cron call 200 in 37 s; Vercel project `crons.enabledAt` set. The first automatic trigger is Mon 19 Oct 2026 06:00 IST, after submission |
| PDF-14 | AI-powered | Mandatory | Gemini classification + digest overview | as PDF-2 | **VERIFIED** | as PDF-2 |

## C. Brief requirements (implementation guidance)
| ID | Requirement | Implementation | Verification | Status | Evidence |
|---|---|---|---|---|---|
| BR-1 | Pipeline discovery→…→digest | `ingest.ts`, `normalize.ts`, `classify.ts`, `score.ts`, `digest/*` | Integration | VERIFIED | `pipeline.test.ts`, `settings-e2e.test.ts` (Test 18) |
| BR-2 | Source registry with all required fields | `data/sources.json`, `sources` table, `/sources` | DB + UI | VERIFIED | `GET /api/sources` in prod; DATA_SOURCE_REGISTER.md |
| BR-3 | Reusable adapters | `adapters/rss.ts`, `adapters/gdelt.ts`, `ADAPTERS` map | Unit | VERIFIED | `normalize.test.ts` |
| BR-4 | Respect robots / terms; no bypass | Google News & BusinessLine disabled (robots); no article-page fetching; 403 sources not retried around | Review | VERIFIED | registry `access_limitations` |
| BR-5 | Provenance per item | `announcement_sources` (URL, publisher, headline, pub date + provenance, retrieved_at, excerpt, raw text, source type), `announcements` (entities, sectors, geos, status) | DB | VERIFIED | Detail page "Sources & related coverage" |
| BR-6 | Last checked shown; pub vs retrieval date; unknown labelled | Dashboard metric, source health, detail page | UI + Test 8 | VERIFIED | `pipeline.test.ts` › missing date |
| BR-7 | 7-day window, Asia/Kolkata, one definition, exploratory windows | `window.ts`; filter `days` 3/7/14/30 | Unit | VERIFIED | `window.test.ts` |
| BR-8 | Layered dedup with supporting sources | L1 URL, L2 headline ±3d, L3 company+date+initiative | Test 7 | VERIFIED | `pipeline.test.ts`, `seed-scenarios.test.ts`; mutation check |
| BR-9 | 24–36 labelled synthetic records covering 16 scenarios | `data/seed-opportunities.json` (30), `seedDemoData()` | Seed tests | VERIFIED | `seed-scenarios.test.ts` (35 tests) |
| BR-10 | Live / needs-verification / synthetic separation | `data_origin`, `verification_status`, mode switch, badges | Test 12 | VERIFIED | `digest.test.ts` separation |
| BR-11 | 100-point configurable score | `score.ts`, settings weights (must sum to 100) | Unit | VERIFIED | `scoring.test.ts` (13 cases) |
| BR-12 | Total, breakdown, reason, evidence, missing info, action, confidence, source quality, freshness | `Opportunity` model + UI | UI | VERIFIED | Detail page; digest payload |
| BR-13 | 7 review statuses + notes, persisted, never overwritten | `opportunity_reviews` append-only | Test 14 | VERIFIED | `pipeline.test.ts`; browser reload check |
| BR-14 | Structured output, validation, bounded retries, timeouts, missing key | `gemini.ts` | Test 11 | VERIFIED | `gemini.test.ts` (8); prod invalid-key incident handled, then recovered |
| BR-15 | Facts vs interpretations vs unknowns; excerpt per claim | `evidence_claims.kind/excerpt/excerpt_verified` | Test 17 | VERIFIED | `gemini.test.ts`, `normalize.test.ts`, eval 64/64 |
| BR-16 | Prompt-injection defence | Untrusted framing, closing-tag stripping, `injection_detected` | Unit + live | VERIFIED | `gemini.test.ts`; smoke call detected injection |
| BR-17 | Deterministic code for dates/dedup/scoring; caching | `ai_input_hash`, per-run budget | Review | VERIFIED | Items with `done` status are never reclassified |
| BR-18 | Digest sections; no padding | `build.ts` | Unit | VERIFIED | `digest.test.ts`; prod digest 0 high priority + "nothing padded" note |
| BR-19 | Idempotent scheduled workflow; manual refresh & generate buttons | `run_key`, `digest_key`, UI buttons | Test 15 | VERIFIED | `pipeline.test.ts` run_key; `digest.test.ts`; prod generation_count 2 |
| BR-20 | Optional email; honest status | `email.ts`, delivery claim | Unit + real send | VERIFIED | Resend accepted the test digest for ayush10ani@gmail.com (id `01a12ee8…`); a rejected send was recorded as `failed` with the provider's reason; `digest.test.ts` (one email per digest) |
| BR-21 | Protected privileged endpoints | `auth.ts` | Test 16 | VERIFIED | `api-security.test.ts`; prod 401s |
| BR-22 | Computed metrics, source health, live/synthetic indicator | `getDashboard()` | Integration | VERIFIED | Metrics derived from rows; no hard-coded totals |
| BR-23 | Filters (10) + sorting | `filters.ts`, `FilterBar.tsx`, `GET /api/opportunities` | Integration | VERIFIED (logic) | `parseFilters`/`applyFilters` exercised in tests; UI manual |
| BR-24 | Detail view contents | `/opportunities/[id]` | UI | VERIFIED | Screenshot / manual |
| BR-25 | Settings page persisted and validated | `/settings`, zod | Test 13 | VERIFIED | `settings-e2e.test.ts`; prod |
| BR-26 | DB with migrations, FKs, indexes | `db/migrations/001_initial.sql`, `scripts/migrate.ts` | Applied on PGlite + Neon | VERIFIED | `/api/health` migrations list |
| BR-27 | API boundaries | 15 route handlers | Tests | VERIFIED | Build route list |
| BR-28 | First-run status screen; demo/live mode | `/status`, mode switch | UI | VERIFIED | Manual |
| BR-29 | Tests 1–18 (+ partner-call, runner, retry tests) | `tests/*` | `npm test` | VERIFIED | 133/133 pass |
| BR-30 | Docs set | `README.md`, `docs/*` | Review | VERIFIED | Files present |
| BR-31 | Security items | headers, zod, cooldowns, text-only rendering, registry-only fetching, timeouts | Review + tests | VERIFIED | ARCHITECTURE.md security section |
| BR-32 | UI polish, responsive, states | Tailwind tokens, skeleton, empty/error states | Browser | VERIFIED | 375px no horizontal scroll; loading skeleton seen |
| BR-34 | Cloud-blocked sources still collected | Mac collector (`scripts/collect-local.ts`, launchd) | launchd run | VERIFIED | NGOBox + FundsForNGOs fetched into prod at 07:00 UTC 12 Oct |
| BR-35 | Separate dev / prod databases | `src/lib/db/url.ts`, Neon `csr-radar-dev` | Unit + scripts | VERIFIED | scripts log `target=dev host=ep-mute-dust…` vs `target=prod host=ep-patient-rain…` |
| BR-33 | Final acceptance report | `docs/FINAL_ACCEPTANCE_REPORT.md` | — | VERIFIED | File present |
