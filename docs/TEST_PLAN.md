# Test Plan & Results

## How to run
```bash
npm test                         # all automated suites (Vitest + PGlite in-process Postgres; no network, no secrets)
npm run lint && npm run typecheck && npm run build
npm run test:gemini              # ONE real Gemini Flash call on a synthetic sample (needs GEMINI_API_KEY)
npx tsx scripts/gemini-eval.ts   # real Gemini over all 30 seed articles → docs/GEMINI_EVAL.md
```
The automated suites use deterministic fixtures: two fixture RSS feeds (`tests/fixtures/*.xml`), a failing source, a rule-based stand-in for the classifier, and mocked fetch for the Gemini client. They run the **real SQL migrations** against PGlite, call **real route handlers**, and exercise the real scoring, dedup and digest code.

## Results (2026-10-12)
| Check | Result |
|---|---|
| `npm test` | **114 passed, 0 failed** (9 files, ~4 s) |
| `npm run lint` | 0 problems |
| `tsc --noEmit` | 0 errors |
| `next build` | success, 22 dynamic routes |
| Mutation check | Weakening the weak-evidence rule → 2 tests fail. Disabling the post-AI merge → 2 tests fail. Restored → 114 pass |
| Real Gemini evaluation | type 28/30, partner-signal safety 30/30, excerpts verified 64/64 (see `docs/GEMINI_EVAL.md`) |

## Required functional tests → evidence
| # | Test | Where | Status |
|---|---|---|---|
| 1 | Fresh digital-skilling announcement discovered, classified, ranked | `pipeline.test.ts` › "fresh digital-skilling…"; `scoring.test.ts` › "fresh relevant official initiative" | PASS |
| 2 | Explicit partner request classified correctly | `pipeline.test.ts` › "explicit partner request…"; seed SYN-004/019; Gemini eval | PASS |
| 3 | Generic CSR ≠ explicit NGO search | `pipeline.test.ts` › "generic CSR statement…"; `scoring.test.ts` › "explicit outranks generic"; SYN-014 | PASS |
| 4 | Irrelevant sector not high priority | `scoring.test.ts` › "irrelevant sector…"; SYN-007/021/028 | PASS |
| 5 | Geographic mismatch reflected | `scoring.test.ts` › "geographic mismatch…", "changing configured geography…"; SYN-008/018/027 | PASS |
| 6 | Stale announcement not fresh | `window.test.ts`; `pipeline.test.ts` › "stale item…"; SYN-015/023 | PASS |
| 7 | Duplicate coverage → one opportunity, multiple sources | `pipeline.test.ts` › "duplicate coverage merges…" (L2); `seed-scenarios.test.ts` › SYN-010→SYN-009 (L3) and SYN-028 not merged | PASS |
| 8 | Missing date not fabricated, not fresh | `window.test.ts`; `normalize.test.ts`; `pipeline.test.ts` › "missing date…"; SYN-011 | PASS |
| 9 | Weak evidence downgraded | `scoring.test.ts` › "weak, unverifiable evidence…"; SYN-012/024 | PASS |
| 10 | Source failure doesn't crash or erase data | `pipeline.test.ts` › "isolating a failing source", "feed outage does not erase…"; observed live (GDELT 429/timeout, FundsForNGOs 403) | PASS |
| 11 | Gemini timeouts, rate limits, invalid output, missing key | `gemini.test.ts` (8 cases); `pipeline.test.ts` › "missing key keeps items pending…"; observed live (invalid key → items failed, digest fallback, recovered after fix) | PASS |
| 12 | Synthetic separation | `digest.test.ts` › "live digest and live metrics never include synthetic"; `seed-scenarios.test.ts` labelling | PASS |
| 13 | Configuration persistence | `settings-e2e.test.ts` › "survive a reload"; production PUT → version 1 → reload | PASS |
| 14 | Review persistence, not overwritten by ingestion | `pipeline.test.ts` › "re-running is idempotent and preserves human reviews"; browser check (note survived reload) | PASS |
| 15 | Digest idempotency, no duplicate emails | `digest.test.ts` › "re-running for the same window…" (1 email, same digest id); production regeneration → `generation_count` 2, same key | PASS |
| 16 | Security: unauthorised calls rejected | `api-security.test.ts` (7 endpoints + cron + forged cookie + cross-origin + fail-closed); production curl → 401 on all | PASS |
| 17 | Evidence traceability | `normalize.test.ts` › excerpt verification; `gemini.test.ts` › "verifies excerpts and flags fabricated facts"; UI shows "Verified quote" / "Not found in source" | PASS |
| 18 | End-to-end journey | `settings-e2e.test.ts` › "retrieve → process → open → inspect evidence → decide → digest → persists"; manual browser run locally + production API run | PASS |

## Additional coverage
- Window boundaries (start exclusive, end inclusive, 1h skew, IST date keys).
- RSS/Atom parsing, HTML/script stripping, canonical URLs, publication names excluded from CSR keyword matching, GDELT rate-limit text treated as failure.
- Scheduled `run_key` executes once; unconfirmed partner-request classification is downgraded; policy versus stale policy; configurable weights.
- Email template escapes untrusted text and blocks `javascript:` links.
- Private notes hidden from anonymous API readers; public endpoints contain no secrets.
- All 29 seed records' expected rankings (`seed-scenarios.test.ts`).

## Manual / production verification performed
| Check | Observation |
|---|---|
| Live pipeline from CLI | 190 items fetched from 13 sources, 24 new, 8 duplicates, 16 classified by Gemini |
| Production cron run (`/api/cron/weekly-digest` with secret) | HTTP 200 in 37 s, `run_key weekly:2026-10-12`, digest `live:2026-10-12` created |
| Production manual refresh (signed in) | 175 fetched, 8 classified by Gemini (0 failed), 2 sources failed and recorded |
| Production digest | Gemini overview; 0 high priority (no padding), 7 monitor, 4 background; failed sources listed; delivery `not_configured` |
| UI | Login, demo digest generation, review save + reload, settings form, sources page, mobile 375px (no horizontal scroll), dark theme |

## Not run / unverified
- **Email delivery through Resend**: no provider credentials. The code path is tested with an injected sender; a real send is unverified.
- **An unattended Vercel Cron trigger**: the first scheduled run after deployment will be Monday 19 Oct 2026 06:00 IST. The cron route itself was invoked in production with the secret. Check Vercel → Cron Jobs / Logs after that date.
- **GDELT success path from production**: rate-limited or timed out in every attempt so far. The parsing is unit-tested.
- **No browser automation suite** (Playwright) is included. UI flows were checked manually.
