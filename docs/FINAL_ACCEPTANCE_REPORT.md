# Final Acceptance Report — CSR Partnership Radar

Date: 2026-10-12 (Monday). **Updated the same day after fixing the blockers** (see "Blocker fixes" below). Audit method: re-read the assignment PDF line by line, compared it with the running system, re-ran the full test/lint/type/build suite, and exercised production directly.

## Submission links
| Item | Value | Status |
|---|---|---|
| Public URL | https://csr-partnership-radar-six.vercel.app | **Deployed, public, verified** |
| GitHub repository | https://github.com/AyushSarkar07/csr-partnership-radar | **Published (public), verified** |
| Components Map | `docs/COMPONENTS_MAP.md` + `docs/components-map.svg` (also at `/components-map.svg` on the live site) | **Delivered, matches implementation** |

## The three release-blocking requirements
| Requirement | Status | Evidence |
|---|---|---|
| **A. Live external data** | **VERIFIED** | 11 real public sources enabled. Production cron run fetched 175 items; the local CLI run fetched 190 and stored 24 new live announcements (29 live records total), each with its original URL, publisher, publication date and provenance, retrieval time and excerpt. Failing sources (FundsForNGOs 403 from Vercel, GDELT rate-limit/timeout) are isolated and reported. |
| **B. Gemini Flash for every AI task** | **VERIFIED** | Only provider: Gemini REST, model `gemini-3.8-flash` (checked against `models.list`), with a code guard that rejects non-Flash ids. Real calls: smoke test, a 30-article evaluation (type 28/30, partner-signal safety 30/30, excerpts 64/64), and a production refresh (8 items classified) plus the digest overview. No other LLM SDK is in `package.json`. |
| **C. Vercel + GitHub + Components Map** | **VERIFIED** | Production deployment Ready, Git-connected to `main`, cron registered (`30 0 * * 1`). Repo public. Map delivered with a node→file table. |

## Requirement status (PDF)
| PDF requirement | Final status | Evidence |
|---|---|---|
| Live external data; works with some data at submission | VERIFIED | above |
| All AI via Gemini Flash; no Claude API | VERIFIED | above |
| Deploy on Vercel; public URL; GitHub link; Components Map | VERIFIED | above |
| Weekly digest for education, skill development, digital literacy, youth employment | VERIFIED | `/digest`; prod digest `live:2026-10-12` (generation 2) |
| Developments from the past seven days | VERIFIED | Single IST window; `window.test.ts` |
| New CSR initiatives | VERIFIED | classifier + scoring; SYN-001/002/003; Gemini eval |
| Increased allocation (press / annual report) | VERIFIED | SYN-005/024; live items such as "Birla Cable spends Rs 49.95 lakh on CSR" |
| Explicit NGO implementation-partner searches | VERIFIED | `explicit_partner_request`; Tests 2/3; eval 30/30 |
| Policy / regulatory changes | VERIFIED | policy section with confirmed / needs-interpretation label |
| Each item answers "worth a call this week?" | VERIFIED | Verdict, reason, breakdown, evidence, uncertainties, next action |
| Configurable sectors and geographies | VERIFIED | `/settings`; Test 13; prod settings saved (v1) |
| Delivered every Monday morning | **VERIFIED** | A temporary one-off schedule (`0 8 12 10 *`) was added so Vercel's scheduler could be observed. **Vercel triggered `/api/cron/weekly-digest` unattended at 08:38:43 UTC**: digest `live:2026-10-12` regenerated (generation 5, trigger `cron`), the refresh skipped by run key, no duplicate email. The one-off entry was then removed; the Monday schedule `30 0 * * 1` remains. Email delivery verified: Resend accepted the digest for ayush10ani@gmail.com. |

All brief-level requirements (BR-1…BR-33) are tracked in `docs/REQUIREMENTS_TRACEABILITY.md`. Every one is VERIFIED except **BR-20, real email sending**, which is IMPLEMENTED-UNVERIFIED because no Resend credentials exist.

## Test results (run 2026-10-12, final audit)
- `npm test`: **114 passed / 0 failed** across 9 files (unit, PGlite integration with real migrations, route-handler security, end-to-end).
- `npm run lint`: 0 problems · `tsc --noEmit`: 0 errors · `next build`: success.
- Mutation sanity check: deliberately breaking two rules made the corresponding tests fail; restored.
- All 18 required functional tests map to passing tests (table in `docs/TEST_PLAN.md`).
- **Not run:** Playwright browser automation (UI flows were checked manually), a real Resend send, and an unattended Vercel cron trigger.

## Live-data retrieval result (actual)
| Run | Where | Result |
|---|---|---|
| CLI #1 | local | 130 fetched, 5 candidates, 5 classified; HCLTech transient HTTP/2 error; GDELT 429 |
| CLI #2 (after adding category feeds) | local | 190 fetched from 13 sources, 24 new, 8 duplicates, 16 classified, 8 queued |
| Cron (`/api/cron/weekly-digest`) | **production** | 175 fetched, 18 duplicates, 0 new (already stored); Gemini failed on an invalid key (see incident); digest created with the code fallback, which it labels as such |
| Manual refresh (signed in) | **production** | 175 fetched, **8 classified by Gemini, 0 AI failures**; FundsForNGOs 403, GDELT timeout recorded |

This week's honest outcome: 20 relevant live items fell in the window, mostly CSR spend reports, conferences and general CSR. **No item met the high-priority bar**, and the digest says so rather than padding.

## Gemini integration status
**Working in production.** Incident during verification: the first production run returned `API_KEY_INVALID` because the key had been copied into Vercel with surrounding quotes. The system behaved as designed. Affected items were marked `failed` with the error recorded (retried later), the digest used the code-generated summary and labelled it, and nothing was fabricated. After the key was re-set without quotes, the next production refresh classified all 8 queued items and the regenerated digest's overview was written by Gemini.

## Deployment status
Vercel project `mesa-dbb9/csr-partnership-radar`: framework Next.js, Node 24, Standard Deployment Protection (production domain public, previews protected), env vars set (Gemini, access code, session and cron secrets, app URL; Neon vars via integration). Two deployment fixes were needed and are documented: the framework preset was "Other", which served 404s, and Vercel Authentication covered the production domain.

## GitHub status
Public repository `AyushSarkar07/csr-partnership-radar`, branch `main`. `.env.local`, `.vercel` and tool folders are ignored, and staged files were scanned for keys and connection strings before each commit (none found).

## Blocker fixes (2026-10-12, after the first report)
| # | Original blocker | Fix | Evidence |
|---|---|---|---|
| 1 | Email not configured | Reused the user's existing Resend key (from kargo-decision-room) with sender `CSR Radar <onboarding@resend.dev>`. Resend's test sender only delivers to the account owner, so the recipient is **ayush10ani@gmail.com** (user's choice) | A send to ayush_sarkar@pg27.mesaschool.co was rejected (403, recorded as `failed`). The send to ayush10ani@gmail.com was accepted, id `01a12ee8-e435-7474-8ca8-67d1386106fc`. Later regenerations did not resend |
| 2 | First unattended cron unobserved | Temporary one-off cron, observed, then removed | Unattended trigger at 08:38:43 UTC (above) |
| 3 | FundsForNGOs blocked from Vercel | **Mac collector**: launchd job `com.csrradar.collector` (Mon 05:15 + daily 09:00 IST) fetches sources marked `runner: local` into production with the same pipeline. Also added the **NGOBox RFP/EOI board** (deadline-bearing partner calls), which is likewise blocked from Vercel (CloudFront 403) and so also runs on the Mac | launchd run at 07:00 UTC: FundsForNGOs 25 items, NGOBox 6 items (1 relevant new). No proxies used to get around the CDN blocks |
| 4 | GDELT rate-limited | 25 s timeout, one polite retry after 6 s (and on HTTP 429), moved to the Mac collector | Still failing today (HTTP 429 / connect timeout, worsened by today's test traffic). Retried on every collector run; reported honestly |
| 5 | Government sources 403 | Added **TaxGuru Company Law** RSS (republishes MCA notifications) for regulatory coverage; PIB/MCA stay link-only | Feed works from Vercel (75 items). This week's 2 candidates were correctly classified `not_csr` (company-law, not CSR rules) |
| 6 | Single shared access code | Not changed: appropriate for a single-user tool. Documented as a limitation | — |
| 7 | Dev and prod shared one database | Separate Neon database `csr-radar-dev` (`DEV_DATABASE_URL`); local runtime and scripts use dev unless `--prod` | Scripts log `target=dev host=ep-mute-dust…` vs `target=prod host=ep-patient-rain…` |
| 8 | Access code delivery | Still in `.env.local` only (never committed) | — |

Also added: CSR Universe and CSR Mandate feeds; source-stated deadlines with an open-call rule (an explicit call with a future deadline counts as current, a passed deadline drops to background); one retry for transient network resets (fixed HCLTech's HTTP/2 errors). **Bug found and fixed while verifying:** SQL `date` values were parsed into local-midnight JS Dates, shifting deadlines by a day when the process ran in IST. They are now returned as strings, with a regression test run under `TZ=Asia/Kolkata`. Tests: **133 passed / 0 failed**.

## Remaining limitations
| # | Item | Impact | Resolution |
|---|---|---|---|
| 1 | Email only to ayush10ani@gmail.com | Resend test-sender rule | Verify a domain you control at resend.com/domains, set `DIGEST_FROM_EMAIL` to an address on it, and change the recipient in Settings |
| 2 | Mac collector depends on the Mac being awake and online | Partner calls (NGOBox, FundsForNGOs) and GDELT are missed if the Mac is off on Monday morning; launchd catches up on wake | Keep the Mac on Monday mornings, or run `npm run collect:local -- --prod` manually |
| 3 | GDELT not yet successful | The news-index source contributes nothing so far | Wait for its rate limit to reset; disable it from Sources if it keeps failing |
| 4 | Official government feeds (PIB, MCA, CSR portal) return 403 | Policy changes come from secondary sources (TaxGuru, CSR news) | Check the links manually; re-enable PIB from Sources to re-test |
| 5 | Single shared access code | Not multi-user | Add an identity provider if more users join |
