# Final Acceptance Report — CSR Partnership Radar

Date: 2026-10-12 (Monday). Audit method: re-read the assignment PDF line by line, compared it with the running system, re-ran the full test/lint/type/build suite, and exercised production directly.

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
| Delivered every Monday morning | **VERIFIED (route + schedule registered); first unattended run pending** | Cron route ran in prod with the secret (HTTP 200, 37 s). Vercel shows the cron enabled. Today's 06:00 slot passed before the first deployment, so the first automatic trigger is **Mon 19 Oct 2026, 06:00–06:59 IST**. |

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

## Remaining blockers / limitations and exact resolution steps
| # | Item | Impact | Resolution |
|---|---|---|---|
| 1 | Email delivery not configured | The digest is stored in-app and printable; it is not emailed | Create a Resend account and verify a domain, set `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` in Vercel, redeploy, then in Settings enable "Email the live digest" and enter the recipient |
| 2 | First unattended cron run not yet observed | The Monday automation is configured but untested by the scheduler itself | After Mon 19 Oct 2026 07:00 IST, check Vercel → Project → Cron Jobs / Logs and the new `live:2026-10-19` digest on `/digest` |
| 3 | FundsForNGOs blocks Vercel IPs (403) | One partner-call source is missing in production runs | Run `npm run pipeline:refresh` locally (same database), or ask the publisher about access |
| 4 | GDELT rate-limits / times out | The news-index source rarely contributes | Optional: raise the timeout for that adapter, or disable it in Sources |
| 5 | Government sources (PIB, MCA, CSR portal) return 403 | Policy changes come only from secondary CSR news | Check manually; the links are in the registry. Re-enable PIB from Sources to re-test |
| 6 | Single shared access code | Not multi-user secure | Add an identity provider (e.g. Neon Auth or Auth.js) if more users are added |
| 7 | Local dev and production share one Neon database | Local experiments affect production data | Create a Neon branch for development and point `.env.local` at it |
| 8 | Access code delivery | Needed to use write features | Shared with the owner separately; never committed. Rotate with `vercel env add ACCESS_CODE production --force` and redeploy |
