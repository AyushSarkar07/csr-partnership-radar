# Data Source Register

Machine-readable registry: [`data/sources.json`](../data/sources.json), synced into the `sources` table by `npm run db:seed`. Each source records: name, type, base/feed URL, sector relevance, geographic coverage, retrieval method, official/secondary flag, credibility weight, enabled flag, access limitations, last attempt, last success, last error and last item count. Status is live on the **Sources** page and at `GET /api/sources`.

## Priority order used (from the brief) and what proved accessible
| Priority | Category | Outcome (verified 2026-10-12) |
|---|---|---|
| 1 | Official corporate newsrooms / CSR pages | Probed Infosys, TCS (403), Tata, Wipro, Mahindra, Tech Mahindra, Reliance Foundation (404 / no feed), Azim Premji Foundation (403), Adani Foundation (empty feed). **HCLTech's official RSS works** and is enabled. Its items are mostly non-CSR, so the pre-filter drops most of them. |
| 2 | Annual / sustainability reports | No machine-readable feeds. Allocation increases arrive through CSR news coverage of annual reports, e.g. "X spends Rs Y Cr on CSR in FY26". |
| 3 | Credible business news | **ET Corporate Trends** and **Mint** RSS (headline and summary only). BusinessLine disabled (robots.txt ambiguous); Business Standard 403. |
| 4 | Government / regulatory | **PIB, MCA and csr.gov.in return HTTP 403** to automated requests, so they are kept as disabled / link-only. Coverage instead comes from **TaxGuru's Company Law feed**, a secondary professional publication that republishes MCA notifications, plus the CSR news feeds. |
| 5 | Explicit partner calls | **NGOBox RFP/EOI board** (HTML listing with deadlines) and **FundsForNGOs** RSS. Both sit behind CDNs (CloudFront, Cloudflare) that return **403 to Vercel's datacenter IPs**, so they are fetched by the **Mac collector** instead. We do not use proxies to get around the blocks. |
| 6 | RSS / search APIs | **India CSR** and **The CSR Journal** (8 WordPress feeds), plus **CSR Universe** and **CSR Mandate**. **GDELT** runs via the Mac collector because Vercel's shared IPs are always rate-limited (HTTP 429). **Google News RSS is disabled because its robots.txt disallows `/rss`.** |

## Where each source runs
- **Vercel** (`/api/refresh`, Monday cron): every enabled source without `config.runner`.
- **Mac collector** (`config.runner = "local"`): `scripts/collect-local.ts --prod`, run by launchd job `com.csrradar.collector` on Mondays at 05:15 IST (before the 06:00 digest) and daily at 09:00 IST. It writes into the production database with the same pipeline code. It only runs while the Mac is awake and online; launchd catches up a missed run on wake. Logs: `~/Library/Logs/csr-radar-collector.log`. Remove it with `scripts/uninstall-mac-collector.sh`.

## Current registry status (production, 2026-10-12 ~07:00 UTC)
| ID | Name | Type | Official | Method | Enabled | Runs on | Last success (UTC) | Items | Last error |
|---|---|---|---|---|---|---|---|---|---|
| `indiacsr` | India CSR | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 10 | — |
| `indiacsr-csr-category` | India CSR — CSR category | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 10 | — |
| `indiacsr-page2` | India CSR — page 2 | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 10 | — |
| `indiacsr-skilling-tag` | India CSR — skill development tag | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 10 | — |
| `thecsrjournal` (+3 category/page feeds) | The CSR Journal | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 10 each | — |
| `thecsruniverse` | The CSR Universe | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 100 | — |
| `csrmandate` | CSR Mandate | csr_specialist_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 10 | — |
| `et-corporate-trends` | Economic Times — Corporate Trends | business_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 50 | — |
| `livemint-companies` | Mint — Companies | business_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 35 | — |
| `taxguru-company-law` | TaxGuru — Company Law (MCA) | regulatory_news | no | rss | yes | Vercel | 2026-10-12 06:41 | 75 | — |
| `hcltech-newsroom` | HCLTech official newsroom | corporate_official | **yes** | rss | yes | Vercel | 2026-10-12 06:41 | 10 | — (transient HTTP/2 resets now retried once) |
| `ngoportal-csr` | NGOportal — CSR project calls | partner_calls | no | rss | yes | Vercel | 2026-10-12 | 1 | — (this week's only item, AROH Foundation RFP, closed 25 Sep: skipped) |
| `ngoportal-funding` | NGOportal — funding opportunities | partner_calls | no | rss | yes | Vercel | 2026-10-12 | 10 | — (India-filtered) |
| `ngobox-rfp` | NGOBox RFP/EOI board | partner_calls | no | ngobox_html | yes | **Mac collector** | 2026-10-12 07:00 | 6 | — (403 from Vercel) |
| `fundsforngos` | FundsForNGOs | partner_calls | no | rss | yes | **Mac collector** | 2026-10-12 07:00 | 25 | — (403 from Vercel) |
| `gdelt-csr-education` | GDELT DOC 2.0 API | news_api | no | gdelt_api | yes | **Mac collector** | never | — | 429 / connect timeout (rate limit, also hit by today's testing) |
| `pib` | Press Information Bureau | government | yes | rss | no | — | — | — | 403 |
| `mca-notifications` | Ministry of Corporate Affairs | government | yes | link_only | no | — | — | — | 403, no feed |
| `csr-portal` | National CSR Portal | government | yes | link_only | no | — | — | — | 403, JS dashboard |
| `google-news-rss` | Google News RSS | news_api | no | rss | no | — | — | — | robots.txt disallows /rss |
| `businessline-companies` | The Hindu BusinessLine | business_news | no | rss | no | — | — | — | robots.txt ambiguous |

## Retrieval rules
- Only URLs from the registry are fetched. Users can enable or disable sources but cannot add arbitrary URLs.
- HTTPS only, 12-second timeout, 3 MB size limit, an identifying User-Agent, and no cookies or logins.
- Article pages are never fetched. Only feed-provided text is used (paywall- and terms-friendly).
- Network resets get one retry after 1 s, and GDELT rate limits one polite retry after 6 s. HTTP 4xx/5xx errors are not retried.
- NGOBox and other listings have no publication date. It stays `unknown`, and the **source-printed deadline** is stored separately (`deadline`, provenance `source_listing`). It is never inferred by AI.
- Deadlines are also read **deterministically from the source text** when it states them ("Last Date for Submission: …", "applications close on …"). Query or clarification dates are ignored, and ambiguous formats are not guessed. Partner-call sources keep items up to 120 days while the stated deadline is ahead, and skip calls whose deadline has passed.
- Each source is fetched independently (`Promise.allSettled`). A failure updates that source's `last_error` and appears on the dashboard and in the digest; existing data is never deleted.
- Items older than 30 days are discarded. Undated items are kept with `published_at = NULL` and provenance `unknown`.
- GDELT `seendate` is stored with provenance `api_seendate` (when GDELT first saw the article), labelled as approximate, and its recency is discounted by 15%.

## Synthetic data
The 30 records in [`data/seed-opportunities.json`](../data/seed-opportunities.json) are fictional, use `https://example.org/synthetic/…` URLs and "(synthetic)" publishers, and are stored with `data_origin = 'synthetic'`. They are not sources. They are listed here only so they are never mistaken for one.
