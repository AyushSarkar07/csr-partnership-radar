import type { Analysis, AnnouncementType } from "../ai/analysis";
import type { Db } from "../db/types";
import { GEO_FIT_LABEL } from "../geo";
import { scoreOpportunity, type ScoreResult } from "../scoring/score";
import type { Settings } from "../settings/schema";
import type { ReportingWindow } from "../time/window";

export type DataOrigin = "live" | "synthetic";

export const REVIEW_STATUSES = [
  "contact_this_week",
  "monitor",
  "research_further",
  "not_relevant",
  "already_contacted",
  "discussion_underway",
  "won_closed",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  contact_this_week: "Worth contacting this week",
  monitor: "Monitor",
  research_further: "Research further",
  not_relevant: "Not relevant",
  already_contacted: "Already contacted",
  discussion_underway: "Partnership discussion underway",
  won_closed: "Won / closed",
};

export interface CoverageRow {
  id: string;
  source_id: string | null;
  source_name: string | null;
  url: string;
  canonical_url: string;
  publisher: string | null;
  headline: string;
  published_at: string | null;
  published_at_provenance: string;
  retrieved_at: string;
  excerpt: string | null;
  source_type: string;
  is_primary: boolean;
  is_official: boolean;
  credibility: number;
}

export interface ClaimRow {
  id: string;
  claim: string;
  kind: "fact" | "interpretation" | "unknown";
  excerpt: string | null;
  excerpt_verified: boolean;
  announcement_source_id: string | null;
}

export interface ReviewRow {
  id: string;
  status: ReviewStatus;
  note: string | null;
  actor: string;
  created_at: string;
}

export interface Opportunity {
  id: string;
  dataOrigin: DataOrigin;
  verificationStatus: "verified" | "needs_verification" | "synthetic";
  seedId: string | null;
  company: string | null;
  headline: string;
  publishedAt: string | null;
  publishedAtProvenance: string;
  firstSeenAt: string;
  aiStatus: string;
  aiModel: string | null;
  aiError: string | null;
  isRelevant: boolean | null;
  announcementType: AnnouncementType | null;
  sectors: string[];
  geographies: string[];
  initiativeName: string | null;
  partnerSignal: "explicit" | "implied" | "none" | null;
  analysis: Analysis | null;
  scenario: Record<string, unknown> | null;
  /** Source-stated application deadline (YYYY-MM-DD) or null. */
  deadline: string | null;
  coverage: CoverageRow[];
  claims: ClaimRow[];
  review: ReviewRow | null;
  score: ScoreResult;
  geoFitLabel: string;
  missingInformation: string[];
  nextAction: string;
}

interface AnnRow {
  id: string;
  data_origin: DataOrigin;
  verification_status: Opportunity["verificationStatus"];
  seed_id: string | null;
  company_name: string | null;
  headline: string;
  published_at: string | null;
  published_at_provenance: string;
  first_seen_at: string;
  ai_status: string;
  ai_model: string | null;
  ai_error: string | null;
  is_relevant: boolean | null;
  announcement_type: AnnouncementType | null;
  sectors: string[];
  geographies: string[];
  initiative_name: string | null;
  partner_signal: Opportunity["partnerSignal"];
  analysis: Analysis | null;
  scenario: Record<string, unknown> | null;
  deadline: string | Date | null;
}

const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
const dateOnly = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

/** Loads every announcement for an origin (optionally specific ids) with coverage, claims and latest review. */
export async function loadOpportunities(
  db: Db,
  origin: DataOrigin,
  settings: Settings,
  window: ReportingWindow,
  ids?: string[],
): Promise<Opportunity[]> {
  const params: unknown[] = [origin];
  let where = "a.data_origin = $1";
  if (ids) {
    params.push(ids);
    where += " and a.id = any($2::uuid[])";
  }
  const anns = await db.query<AnnRow>(
    `select a.*, c.name as company_name from announcements a
       left join companies c on c.id = a.company_id
      where ${where}
      order by a.published_at desc nulls last, a.first_seen_at desc`,
    params,
  );
  if (!anns.length) return [];
  const annIds = anns.map((a) => a.id);

  const [coverage, claims, reviews] = await Promise.all([
    db.query<CoverageRow & { announcement_id: string }>(
      `select s.id, s.announcement_id, s.source_id, s.url, s.canonical_url, s.publisher, s.headline, s.published_at,
              s.published_at_provenance, s.retrieved_at, s.excerpt, s.source_type, s.is_primary, s.is_official,
              s.credibility, src.name as source_name
         from announcement_sources s left join sources src on src.id = s.source_id
        where s.announcement_id = any($1::uuid[])
        order by s.is_primary desc, s.published_at asc nulls last`,
      [annIds],
    ),
    db.query<ClaimRow & { announcement_id: string }>(
      "select * from evidence_claims where announcement_id = any($1::uuid[]) order by created_at, id",
      [annIds],
    ),
    db.query<ReviewRow & { announcement_id: string }>(
      `select distinct on (announcement_id) * from opportunity_reviews
        where announcement_id = any($1::uuid[]) order by announcement_id, created_at desc`,
      [annIds],
    ),
  ]);

  const group = <T extends { announcement_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.announcement_id, [...(m.get(r.announcement_id) ?? []), r]);
    return m;
  };
  const covBy = group(coverage);
  const claimBy = group(claims);
  const revBy = group(reviews);

  return anns.map((a) => {
    const cov = (covBy.get(a.id) ?? []).map((c) => ({
      ...c,
      credibility: Number(c.credibility),
      published_at: iso(c.published_at),
      retrieved_at: iso(c.retrieved_at)!,
    }));
    const cl = claimBy.get(a.id) ?? [];
    const rev = revBy.get(a.id)?.[0] ?? null;
    const score = scoreOpportunity(
      {
        isRelevant: a.is_relevant,
        announcementType: a.announcement_type,
        partnerSignal: a.partner_signal,
        sectors: a.sectors ?? [],
        otherSectors: a.analysis?.other_sectors ?? [],
        geographies: a.geographies ?? [],
        publishedAt: a.published_at ? new Date(a.published_at) : null,
        publishedAtProvenance: a.published_at_provenance,
        sources: cov.map((c) => ({ credibility: c.credibility, isOfficial: c.is_official, publisher: c.publisher })),
        claims: cl.map((c) => ({ kind: c.kind, excerptVerified: c.excerpt_verified })),
        aiStatus: a.ai_status,
        fundingSignal: Boolean(a.analysis?.funding_signal?.present),
        deadline: dateOnly(a.deadline),
      },
      settings,
      window,
    );
    const missing = [...(a.analysis?.missing_information ?? [])];
    if (score.freshness === "unknown" || (score.freshness === "open_call" && !a.published_at)) missing.unshift("Publication date not verified — confirm on the original source.");
    if (score.flags.includes("deadline_passed")) missing.unshift(`Application deadline (${dateOnly(a.deadline)}) has passed.`);
    if (score.geoFit === "unknown") missing.push("Programme geography not stated.");
    if (cov.length === 1 && !cov[0].is_official && a.data_origin === "live") missing.push("Single secondary source — look for the company's own announcement.");
    return {
      id: a.id,
      dataOrigin: a.data_origin,
      verificationStatus: a.verification_status,
      seedId: a.seed_id,
      company: a.company_name ?? a.analysis?.company_name ?? null,
      headline: a.headline,
      publishedAt: iso(a.published_at),
      publishedAtProvenance: a.published_at_provenance,
      firstSeenAt: iso(a.first_seen_at)!,
      aiStatus: a.ai_status,
      aiModel: a.ai_model,
      aiError: a.ai_error,
      isRelevant: a.is_relevant,
      announcementType: a.announcement_type,
      sectors: a.sectors ?? [],
      geographies: a.geographies ?? [],
      initiativeName: a.initiative_name,
      partnerSignal: a.partner_signal,
      analysis: a.analysis,
      scenario: a.scenario,
      deadline: dateOnly(a.deadline),
      coverage: cov,
      claims: cl,
      review: rev ? { ...rev, created_at: iso(rev.created_at)! } : null,
      score,
      geoFitLabel: GEO_FIT_LABEL[score.geoFit],
      missingInformation: [...new Set(missing)],
      nextAction: a.analysis?.suggested_next_action ?? defaultNextAction(a.ai_status),
    };
  });
}

function defaultNextAction(aiStatus: string) {
  if (aiStatus === "pending") return "Awaiting AI analysis — open the source to review manually.";
  if (aiStatus === "failed") return "AI analysis failed — review the source manually or retry the refresh.";
  return "Review the source.";
}

export async function persistScores(db: Db, opps: Opportunity[], settingsVersion: number) {
  for (const o of opps) {
    await db.query(
      `insert into opportunity_scores (announcement_id, total, priority, confidence, breakdown, settings_version, computed_at)
       values ($1,$2,$3,$4,$5::jsonb,$6, now())
       on conflict (announcement_id) do update set total = excluded.total, priority = excluded.priority,
         confidence = excluded.confidence, breakdown = excluded.breakdown,
         settings_version = excluded.settings_version, computed_at = now()`,
      [o.id, o.score.total, o.score.priority, o.score.confidence, JSON.stringify(o.score), settingsVersion],
    );
  }
}

export async function addReview(db: Db, id: string, status: ReviewStatus, note: string | null, actor: string) {
  const exists = await db.query("select 1 from announcements where id = $1", [id]);
  if (!exists.length) return null;
  const rows = await db.query<ReviewRow>(
    `insert into opportunity_reviews (announcement_id, status, note, actor) values ($1,$2,$3,$4) returning *`,
    [id, status, note, actor],
  );
  await db.query(
    "insert into audit_events (actor, action, entity, entity_id, details) values ($1,'review.add','announcement',$2,$3::jsonb)",
    [actor, id, JSON.stringify({ status, hasNote: Boolean(note) })],
  );
  return rows[0];
}

export async function reviewHistory(db: Db, id: string): Promise<ReviewRow[]> {
  const rows = await db.query<ReviewRow>(
    "select id, status, note, actor, created_at from opportunity_reviews where announcement_id = $1 order by created_at desc",
    [id],
  );
  return rows.map((r) => ({ ...r, created_at: iso(r.created_at)! }));
}
