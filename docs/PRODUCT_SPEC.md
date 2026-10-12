# Product Spec — CSR Partnership Radar

## User and job to be done
**Ananya**, Head of Corporate Partnerships at a Pune-based NGO running skilling programmes for school dropouts and first-generation job seekers. Today she hears about roughly a third of relevant announcements, often too late (PDF). She needs a **weekly digest, delivered Monday morning**, covering the **past seven days**, where every item answers: *is this worth a call this week, and why?*

## Scope (from the assignment PDF)
Developments to surface:
1. New CSR initiatives in education, skill development, digital literacy and youth employment.
2. Signals of increased CSR allocation (press or annual report).
3. Companies explicitly seeking NGO implementation partners.
4. Policy or regulatory changes that affect how companies deploy CSR funds.

Constraints: live external data wherever possible, Gemini Flash for every AI task, deployment on Vercel, a public URL, a GitHub repo and a Components Map. Focus sectors and geographic priorities must be configurable.

## Product principles
- **A decision per item, not a feed.** Each item shows a verdict ("Yes, worth a call this week" / "Not yet, monitor" / …), a primary reason, a score breakdown, the evidence of intent, the uncertainties and a next action.
- **Evidence first.** Every factual claim quotes the source, and the quote is checked by code. Interpretations and unknowns are labelled as such.
- **No fake completeness.** Unknown dates stay unknown. Thin weeks produce short digests. Failed sources are listed. Synthetic data is always labelled and kept apart from live data.
- **The AI recommends; Ananya decides.** Human decisions are stored append-only and survive reprocessing. Nothing is ever sent to companies automatically.

## Features (implemented)
| Area | What exists |
|---|---|
| Dashboard `/` | Live/demo switch, 6 computed metrics, actions (Refresh intelligence, Generate digest now), 12 filters + sort in the URL, ranked cards, sector distribution, source health |
| Opportunity `/opportunities/[id]` | Summary, why it matters, intent evidence, policy implication, verified quotes, interpretations, missing info, sources (publication vs retrieval date + provenance), related announcements, decision form, status history, score breakdown, confidence reasons, extracted entities, synthetic scenario |
| Digest `/digest`, `/digest/[id]` | Gemini overview + top actions, the 5 sections, delivery status, archive, print/PDF |
| Sources `/sources` | Registry with type, method, credibility, coverage, limitations, last success/error, per-run filter counts, enable/disable |
| Settings `/settings` | Sectors (key/label/priority/keywords), excluded sectors, operating/expansion/excluded geographies, programme types, beneficiary groups, weights (must total 100), recency thresholds, priority thresholds, window, timezone, digest on/off and caps, email recipient, data mode, demo reset |
| Status `/status` | First-run checklist: database, seed, live data, Gemini, auth, cron, email |
| Scheduled job | Vercel Cron, Mondays 06:00 IST, idempotent |

## Review statuses
Worth contacting this week · Monitor · Research further · Not relevant · Already contacted · Partnership discussion underway · Won / closed. "Not relevant" and "Won / closed" remove an item from future digests.

## Out of scope / not built
- Multi-user accounts and roles. There is a single access code; see ASSUMPTIONS A-14.
- Scraping pages behind logins or paywalls, or sites whose robots.txt forbids it.
- Automated outreach.
- Full-text retrieval of article pages. Only the feed-provided text is used.
