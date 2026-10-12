# Assumptions & Design Decisions

Legend: **[PDF]** fact from the assignment · **[CHOICE]** implementation decision · **[VERIFIED]** checked during the build · **[SYNTHETIC]** demonstration data.

## Facts supplied by the assignment
- [PDF] User: Ananya, Head of Corporate Partnerships, Pune-based education NGO serving school dropouts and first-generation job seekers.
- [PDF] Sectors: education, skill development, digital literacy, youth employment.
- [PDF] Coverage: new CSR initiatives, increased allocation (press / annual report), explicit NGO-partner searches, and policy/regulatory changes affecting CSR deployment, all from the past seven days.
- [PDF] Delivery: weekly, Monday morning, before the outreach week.
- [PDF] Sectors and geographies must be configurable. Live external data wherever possible. Gemini Flash for every AI task. Vercel deployment with a public URL, GitHub repo and Components Map.

## Consequential assumptions
| ID | Assumption | Type | Rationale / consequence |
|---|---|---|---|
| A-1 | **Reporting window = (end − 7×24h, end]**, with end = reference time, in **Asia/Kolkata** | CHOICE | One definition (`src/lib/time/window.ts`) shared by ingestion, dashboard, filters and digest. Monday 06:00 IST runs therefore cover back-to-back 168-hour periods. Users can choose 3/7/14/30-day exploratory windows. |
| A-2 | **Monday delivery = 06:00 IST** (`30 0 * * 1` UTC) | CHOICE | "Before she starts her outreach week". Vercel Hobby cron precision is ±59 min, so the run lands between 06:00 and 07:00 IST. |
| A-3 | **Default operating geographies: Pune, Pimpri-Chinchwad. Expansion: Maharashtra, Karnataka, Gujarat** | CHOICE | The PDF only says "Pune-based". Expansion targets are placeholders that Ananya can edit. A company is never assumed to operate in Pune. |
| A-4 | **Geography matching** uses an explicit city→state gazetteer (`src/lib/geo.ts`). A programme in a configured city's state counts as "state-wide coverage" (80% of geo points) | CHOICE | Avoids silent inference. Unknown geography scores 35%, national 55%, mismatch 15%, excluded 0%. |
| A-5 | **Scoring weights 25/25/20/15/15** (sector/intent/recency/geography/evidence) | CHOICE | Taken from the brief and configurable. Intent values: explicit partner request 1.0, new initiative .76, increased allocation .70, expansion .62, policy .50, general CSR .28, historical .12, not CSR 0. +.06 if NGO partners are mentioned, +.04 for a funding signal. |
| A-6 | **Recency decay**: ≤48h 100%, ≤96h 75%, ≤7d 50%, outside window 0%, unknown date 20% | CHOICE | Thresholds are configurable. Unknown dates can never be "fresh" or High priority. |
| A-7 | **High priority requires**: score ≥ 70, fresh date, intent ≥ 0.6, non-weak evidence, geography not mismatched/excluded | CHOICE | Prevents a high total built on recency and source quality alone, e.g. a CEO interview, or a strong programme in a region the NGO can't serve. |
| A-8 | **Partner request vs general CSR**: `explicit` only when the text invites NGOs or partners (call, EOI, proposals). A partner-request classification without an explicit signal is scored as a new initiative and flagged | CHOICE | Directly addresses "mentioning education ≠ accepting proposals". |
| A-9 | **"Live verified"** = real retrieved item + known publication date + ≥1 factual claim whose excerpt was found verbatim in the retrieved text | CHOICE | A transparent, mechanical definition. It verifies grounding, not the truth of the publisher's claim. |
| A-10 | **Deduplication**: L1 canonical URL; L2 headline token Jaccard ≥ 0.6 within ±3 days (before AI); L3 same normalised company within ±4 days and (headline similarity ≥ 0.3 or same initiative name) (after AI). Earlier-seen record stays primary | CHOICE | Semantic embeddings were judged unnecessary at this volume and would add a second AI call per item. |
| A-11 | **Only feed-provided text is analysed** (RSS description / content:encoded). Article pages are not fetched | CHOICE | Respects paywalls and terms, keeps the request footprint small, and avoids arbitrary URL fetching. Feeds without full text yield headline-level evidence, which is scored as weaker. |
| A-12 | **Credibility weights**: official company/government/annual report .95, business news .80, CSR specialist news .70, partner-call listing .60, news API .55, unknown/blog .40 | CHOICE | Used for evidence quality only, and editable in `data/sources.json`. |
| A-13 | **AI budget**: ≤16 Gemini classifications per run, concurrency 3, 3 attempts per item across runs, cached by input hash | CHOICE | Fits Vercel function limits (maxDuration 300s) and controls cost. Leftovers are processed on the next run. |
| A-14 | **Access control**: public read; writes need a shared `ACCESS_CODE` that yields a signed HttpOnly cookie (7 days); cron needs `CRON_SECRET`. Review notes are private | CHOICE | A single-user tool. Not a full identity system, which is documented as a limitation. |
| A-15 | **Email delivery is optional (Resend)** and off by default | CHOICE | No provider credentials were available. The status reads "not configured", never "sent". |
| A-16 | **Database**: Neon Postgres through the Vercel Marketplace, free tier | CHOICE | The user's Supabase free tier was full (2 projects), and they chose Neon. Local dev and production share one database. |
| A-17 | **Gemini model `gemini-3.8-flash`** | VERIFIED | Listed by the `models.list` API with the provided key on 2026-10-12. Structured output via `responseJsonSchema` was confirmed by a live call. |
| A-18 | **Source accessibility** (see DATA_SOURCE_REGISTER) | VERIFIED | Checked with curl and in production on 2026-10-12. FundsForNGOs returns 403 to Vercel IPs, and GDELT is often rate-limited or slow. |
| A-19 | **Synthetic dataset**: 30 fictional records with a fixed reference time of Mon 12 Oct 2026 06:00 IST | SYNTHETIC | Reproducible demo and tests. Companies are fictional, URLs use `example.org`, regulator scenarios are explicitly labelled "fictional scenario", and real companies are never named. |
| A-20 | **Policy items** go to their own section regardless of sector match; stale policy items go to background | CHOICE | Policy affects all CSR deployment, not one sector. |

## What is deliberately not inferred
Budgets, deadlines, contacts, eligibility and partner intent are never inferred. The Gemini prompt forbids it, the schema has `missing_information`, and code adds missing-info notes for unknown dates, unknown geography and single secondary sources.
