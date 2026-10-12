# Gemini Flash Classification Evaluation

Real Gemini API calls (not mocks) over the 31 synthetic seed articles, comparing against hand-written expectations. Run on 2026-10-12 with `npx tsx scripts/gemini-eval.ts`.

- Model: gemini-3.8-flash · records: 30/30
- Announcement type exact match: 28/30 · Partner-signal safety (never false 'explicit'): 30/30 · Fact excerpts verified: 64/64

**Disagreements (2), both defensible:** SYN-012 (unsourced rumour) was classified `not_csr` instead of `new_initiative`, which is more conservative and still ranks below High. SYN-030 (a report about *last year's* spending) was classified `historical_activity` instead of `general_csr`, a reasonable reading. Neither produced a false partner request. "Partner-signal safety" means Gemini never labelled a non-explicit item as `explicit`.

Note: the seed file deliberately contains two fabricated 'facts' (SYN-012, SYN-024) to test excerpt verification. Gemini did not reproduce them: every excerpt it quoted was found verbatim in the source text.

| Seed | Expected type | Gemini type | Expected partner | Gemini partner | Verified facts |
|---|---|---|---|---|---|
| SYN-001 | new_initiative | new_initiative ✓ | implied | implied ✓ | 3/3 |
| SYN-002 | new_initiative | new_initiative ✓ | none | none ✓ | 3/3 |
| SYN-003 | new_initiative | new_initiative ✓ | implied | implied ✓ | 3/3 |
| SYN-004 | explicit_partner_request | explicit_partner_request ✓ | explicit | explicit ✓ | 3/3 |
| SYN-005 | increased_allocation | increased_allocation ✓ | none | none ✓ | 3/3 |
| SYN-006 | historical_activity | historical_activity ✓ | none | none ✓ | 2/2 |
| SYN-007 | new_initiative | new_initiative ✓ | none | none ✓ | 3/3 |
| SYN-008 | new_initiative | new_initiative ✓ | none | none ✓ | 3/3 |
| SYN-009 | new_initiative | new_initiative ✓ | implied | implied ✓ | 3/3 |
| SYN-010 | new_initiative | new_initiative ✓ | implied | implied ✓ | 2/2 |
| SYN-011 | new_initiative | new_initiative ✓ | none | none ✓ | 2/2 |
| SYN-012 | new_initiative | not_csr ✗ | none | none ✓ | 1/1 |
| SYN-013 | policy_change | policy_change ✓ | none | implied ✓ | 2/2 |
| SYN-014 | general_csr | general_csr ✓ | none | none ✓ | 2/2 |
| SYN-015 | new_initiative | new_initiative ✓ | implied | implied ✓ | 2/2 |
| SYN-016 | programme_expansion | programme_expansion ✓ | none | none ✓ | 2/2 |
| SYN-017 | general_csr | general_csr ✓ | none | none ✓ | 2/2 |
| SYN-018 | explicit_partner_request | explicit_partner_request ✓ | explicit | explicit ✓ | 2/2 |
| SYN-019 | explicit_partner_request | explicit_partner_request ✓ | explicit | explicit ✓ | 2/2 |
| SYN-020 | programme_expansion | programme_expansion ✓ | none | none ✓ | 2/2 |
| SYN-021 | not_csr | not_csr ✓ | none | none ✓ | 3/3 |
| SYN-022 | policy_change | policy_change ✓ | none | none ✓ | 2/2 |
| SYN-023 | policy_change | policy_change ✓ | none | none ✓ | 1/1 |
| SYN-024 | increased_allocation | increased_allocation ✓ | none | none ✓ | 2/2 |
| SYN-025 | new_initiative | new_initiative ✓ | none | none ✓ | 1/1 |
| SYN-026 | new_initiative | new_initiative ✓ | none | none ✓ | 2/2 |
| SYN-027 | new_initiative | new_initiative ✓ | none | none ✓ | 1/1 |
| SYN-028 | new_initiative | new_initiative ✓ | none | none ✓ | 1/1 |
| SYN-029 | programme_expansion | programme_expansion ✓ | implied | implied ✓ | 2/2 |
| SYN-030 | general_csr | historical_activity ✗ | none | none ✓ | 2/2 |
