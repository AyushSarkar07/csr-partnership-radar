import seedFile from "../../data/seed-opportunities.json";
import type { Analysis, AnnouncementType } from "./ai/analysis";
import type { Db } from "./db/types";
import { mergeDuplicates } from "./pipeline/ingest";
import { canonicalizeUrl, containsExcerpt, normalizeCompany, normalizeHeadline, sha256 } from "./text";

/** Default credibility by source type (also used for synthetic sources). */
export const TYPE_CREDIBILITY: Record<string, { credibility: number; official: boolean }> = {
  corporate_official: { credibility: 0.95, official: true },
  annual_report: { credibility: 0.95, official: true },
  government: { credibility: 0.95, official: true },
  business_news: { credibility: 0.8, official: false },
  csr_specialist_news: { credibility: 0.7, official: false },
  partner_calls: { credibility: 0.6, official: false },
  news_api: { credibility: 0.55, official: false },
  other: { credibility: 0.4, official: false },
};

export interface SeedRecord {
  seed_id: string;
  company: string | null;
  headline: string;
  published_at: string | null;
  source: { publisher: string; url: string; source_type: string };
  text: string;
  type: AnnouncementType;
  relevant?: boolean;
  sectors: string[];
  other_sectors: string[];
  geographies: string[];
  initiative: string | null;
  beneficiaries: string[];
  funding: string | null;
  partner_signal: "explicit" | "implied" | "none";
  partner_evidence: string;
  summary: string;
  why: string;
  next_action: string;
  outreach_angle: string | null;
  missing: string[];
  policy_implication?: { implication: string; status: "confirmed" | "needs_interpretation" };
  claims: Array<{ claim: string; kind: "fact" | "interpretation" | "unknown"; excerpt: string | null }>;
  review?: { status: string; note: string };
  scenario: { ids: number[]; description: string; expected: Record<string, unknown>; test_explanation: string };
}

export const SEED_RECORDS = seedFile.records as SeedRecord[];

export function seedAnalysis(r: SeedRecord): Analysis {
  return {
    is_csr_relevant: r.relevant ?? r.type !== "not_csr",
    company_name: r.company,
    initiative_name: r.initiative,
    announcement_type: r.type,
    sectors: r.sectors,
    other_sectors: r.other_sectors,
    geographies: r.geographies,
    beneficiary_groups: r.beneficiaries,
    funding_signal: { present: Boolean(r.funding), description: r.funding },
    implementation_partner_signal: { level: r.partner_signal, evidence: r.partner_evidence },
    summary: r.summary,
    why_it_matters: r.why,
    evidence_claims: r.claims,
    missing_information: r.missing,
    suggested_next_action: r.next_action,
    outreach_angle: r.outreach_angle,
    policy_implication: r.policy_implication ?? null,
    injection_detected: false,
  };
}

/**
 * Loads the synthetic dataset. Idempotent: records whose source URL already
 * exists are skipped. `reset` wipes synthetic rows only — live data is never touched.
 */
export async function seedDemoData(db: Db, opts: { reset?: boolean } = {}) {
  if (opts.reset) {
    await db.query("delete from announcements where data_origin='synthetic'");
    await db.query("delete from companies where data_origin='synthetic'");
    await db.query("delete from digests where data_mode='demo'");
  }
  let inserted = 0;
  let merged = 0;
  for (const r of SEED_RECORDS) {
    const canonical = canonicalizeUrl(r.source.url)!;
    const exists = await db.query("select 1 from announcement_sources where canonical_url=$1", [canonical]);
    if (exists.length) continue;
    const analysis = seedAnalysis(r);
    const cred = TYPE_CREDIBILITY[r.source.source_type] ?? TYPE_CREDIBILITY.other;
    const annId = await db.tx(async (q) => {
      let companyId: string | null = null;
      if (r.company) {
        companyId = (
          await q.query<{ id: string }>(
            `insert into companies (name, normalized_name, data_origin) values ($1,$2,'synthetic')
             on conflict (normalized_name, data_origin) do update set name=companies.name returning id`,
            [r.company, normalizeCompany(r.company)],
          )
        )[0].id;
      }
      const id = (
        await q.query<{ id: string }>(
          `insert into announcements (data_origin, verification_status, seed_id, company_id, headline, normalized_headline,
             published_at, published_at_provenance, primary_text, content_hash, ai_status, ai_model, ai_processed_at,
             is_relevant, announcement_type, sectors, geographies, initiative_name, partner_signal, analysis, scenario)
           values ('synthetic','synthetic',$1,$2,$3,$4,$5,$6,$7,$8,'fixture','fixture:seed-v1',now(),$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)
           returning id`,
          [r.seed_id, companyId, r.headline, normalizeHeadline(r.headline), r.published_at,
            r.published_at ? "synthetic" : "unknown", r.text, sha256(r.headline + r.text), analysis.is_csr_relevant, r.type,
            r.sectors, r.geographies, r.initiative, r.partner_signal, JSON.stringify(analysis), JSON.stringify(r.scenario)],
        )
      )[0].id;
      const srcId = (
        await q.query<{ id: string }>(
          `insert into announcement_sources (announcement_id, source_id, data_origin, url, canonical_url, publisher, headline,
             normalized_headline, published_at, published_at_provenance, excerpt, raw_text, source_type, is_primary, credibility, is_official)
           values ($1,null,'synthetic',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13) returning id`,
          [id, r.source.url, canonical, r.source.publisher, r.headline, normalizeHeadline(r.headline), r.published_at,
            r.published_at ? "synthetic" : "unknown", r.text.slice(0, 400), r.text, r.source.source_type, cred.credibility, cred.official],
        )
      )[0].id;
      // Claims go through the same verbatim-excerpt verification as live AI output.
      for (const c of r.claims) {
        await q.query(
          `insert into evidence_claims (announcement_id, announcement_source_id, claim, kind, excerpt, excerpt_verified)
           values ($1,$2,$3,$4,$5,$6)`,
          [id, srcId, c.claim, c.kind, c.excerpt, Boolean(c.excerpt && containsExcerpt(`${r.headline}\n${r.text}`, c.excerpt))],
        );
      }
      if (r.review) {
        await q.query(
          "insert into opportunity_reviews (announcement_id, status, note, actor) values ($1,$2,$3,'seed')",
          [id, r.review.status, r.review.note],
        );
      }
      return id;
    });
    inserted++;
    // Same post-classification dedup used for live data.
    if (await mergeDuplicates(db, annId)) merged++;
  }
  return { inserted, merged, total: SEED_RECORDS.length };
}
