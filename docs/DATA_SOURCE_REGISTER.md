# Data Source Register

Machine-readable registry: [`data/sources.json`](../data/sources.json), synced into the `sources` table by `npm run db:seed`. Each source records: name, type, base/feed URL, sector relevance, geographic coverage, retrieval method, official/secondary flag, credibility weight, enabled flag, access limitations, last attempt, last success, last error and last item count. Status is live on the **Sources** page and at `GET /api/sources`.

## Priority order used (from the brief) and what proved accessible
| Priority | Category | Outcome (verified 2026-10-12) |
|---|---|---|
| 1 | Official corporate newsrooms / CSR pages | Probed Infosys, TCS (403), Tata, Wipro, Mahindra, Tech Mahindra, Reliance Foundation (404 / no feed), Azim Premji Foundation (403), Adani Foundation (empty feed). **HCLTech's official RSS works** and is enabled. Its items are mostly non-CSR, so the pre-filter drops most of them. |
| 2 | Annual / sustainability reports | No machine-readable feeds found. Allocation increases reach us through CSR specialist news coverage of annual reports, e.g. "X spends Rs Y Cr on CSR in FY26". |
| 3 | Credible business news | **ET Corporate Trends** and **Mint Companies** RSS work (headline and summary only, so evidence is weaker). BusinessLine disabled (robots.txt ambiguous). Business Standard returned 403. |
| 4 | Government / regulatory | **PIB, MCA and csr.gov.in all return HTTP 403** to automated requests; recorded as disabled / link-only. Policy news currently arrives through the CSR specialist feeds. |
| 5 | Explicit partner calls | **FundsForNGOs** RSS (global, filtered to India mentions). Works from India, but **returns 403 from Vercel's servers**. |
| 6 | RSS / search APIs | **India CSR** and **The CSR Journal**: 8 public WordPress feeds (main, page 2, category and tag feeds), the most productive sources. **GDELT DOC API** enabled but frequently rate-limited or timing out. **Google News RSS search is disabled because its robots.txt disallows `/rss`.** |

## Current registry status (production, after the 2026-10-12 runs)
| ID | Name | Type | Official | Method | Enabled | Last success (UTC) | Items | Last error |
|---|---|---|---|---|---|---|---|---|
| `indiacsr` | India CSR (indiacsr.in) | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `indiacsr-csr-category` | India CSR — CSR category | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `indiacsr-page2` | India CSR — page 2 | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `indiacsr-skilling-tag` | India CSR — skill development tag | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `thecsrjournal` | The CSR Journal | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `thecsrjournal-education` | The CSR Journal — education | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `thecsrjournal-page2` | The CSR Journal — page 2 | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `thecsrjournal-skilling-tag` | The CSR Journal — skill development tag | csr_specialist_news | no | rss | yes | 2026-10-12 02:05 | 10 | — |
| `et-corporate-trends` | Economic Times — Corporate Trends | business_news | no | rss | yes | 2026-10-12 02:05 | 50 | — |
| `livemint-companies` | Mint — Companies | business_news | no | rss | yes | 2026-10-12 02:05 | 35 | — |
| `hcltech-newsroom` | HCLTech official newsroom RSS | corporate_official | **yes** | rss | yes | 2026-10-12 02:05 | 10 | — (one transient HTTP/2 stream error locally) |
| `fundsforngos` | FundsForNGOs | partner_calls | no | rss | yes | 2026-10-12 01:38 (local) | 25 | HTTP 403 from Vercel |
| `gdelt-csr-education` | GDELT DOC 2.0 API | news_api | no | gdelt_api | yes | never | — | rate limit / 12s timeout |
| `pib` | Press Information Bureau RSS | government | yes | rss | **no** | — | — | 403 during verification |
| `mca-notifications` | Ministry of Corporate Affairs | government | yes | link_only | no | — | — | 403, no feed |
| `csr-portal` | National CSR Portal | government | yes | link_only | no | — | — | 403, JS dashboard |
| `google-news-rss` | Google News RSS search | news_api | no | rss | **no** | — | — | robots.txt disallows /rss |
| `businessline-companies` | The Hindu BusinessLine | business_news | no | rss | **no** | — | — | robots.txt ambiguous |

## Retrieval rules
- Only URLs from the registry are fetched. Users can enable or disable sources but cannot add arbitrary URLs.
- HTTPS only, 12-second timeout, 3 MB size limit, an identifying User-Agent, and no cookies or logins.
- Article pages are never fetched. Only feed-provided text is used (paywall- and terms-friendly).
- Each source is fetched independently (`Promise.allSettled`). A failure updates that source's `last_error` and appears on the dashboard and in the digest; existing data is never deleted.
- Items older than 30 days are discarded. Undated items are kept with `published_at = NULL` and provenance `unknown`.
- GDELT `seendate` is stored with provenance `api_seendate` (when GDELT first saw the article), labelled as approximate, and its recency is discounted by 15%.

## Synthetic data
The 30 records in [`data/seed-opportunities.json`](../data/seed-opportunities.json) are fictional, use `https://example.org/synthetic/…` URLs and "(synthetic)" publishers, and are stored with `data_origin = 'synthetic'`. They are not sources. They are listed here only so they are never mistaken for one.
