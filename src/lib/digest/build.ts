import { ANNOUNCEMENT_TYPE_LABEL } from "../ai/analysis";
import type { Opportunity } from "../repo/opportunities";
import type { Settings } from "../settings/schema";
import type { ReportingWindow } from "../time/window";

export type DigestSection = "high_priority" | "monitor" | "policy" | "background";

export interface DigestItemPayload {
  announcementId: string;
  section: DigestSection;
  rank: number;
  dataOrigin: "live" | "synthetic";
  verificationStatus: string;
  company: string | null;
  headline: string;
  publishedAt: string | null;
  publishedAtProvenance: string;
  freshness: string;
  sources: Array<{ publisher: string | null; url: string; sourceType: string; isPrimary: boolean }>;
  sectors: string[];
  geographies: string[];
  geoFit: string;
  announcementType: string | null;
  whatWasAnnounced: string;
  whyItMatters: string;
  intentEvidence: string;
  fundingSignal: string | null;
  supportingClaims: Array<{ claim: string; excerpt: string | null; verified: boolean }>;
  score: number;
  scoreBreakdown: Array<{ label: string; points: number; max: number; explanation: string }>;
  primaryReason: string;
  verdict: string;
  confidence: string;
  evidenceStrength: string;
  uncertainties: string[];
  nextAction: string;
  outreachAngle: string | null;
  policyImplication: { implication: string; status: string } | null;
  reviewStatus: string | null;
}

export interface FailedSource {
  sourceId: string;
  name: string;
  error: string;
  at: string | null;
}

export interface DigestContent {
  window: { start: string; end: string; days: number; timezone: string };
  mode: "live" | "demo";
  counts: Record<DigestSection, number> & { consideredInWindow: number; excludedByReview: number };
  sections: Record<DigestSection, DigestItemPayload[]>;
  failedSources: FailedSource[];
  limitedEvidenceNote: string | null;
}

const CLOSED = new Set(["not_relevant", "won_closed"]);

export function toPayload(o: Opportunity, section: DigestSection, rank: number, sectorLabels: Map<string, string>): DigestItemPayload {
  const a = o.analysis;
  const partner = a?.implementation_partner_signal;
  return {
    announcementId: o.id,
    section,
    rank,
    dataOrigin: o.dataOrigin,
    verificationStatus: o.verificationStatus,
    company: o.company,
    headline: o.headline,
    publishedAt: o.publishedAt,
    publishedAtProvenance: o.publishedAtProvenance,
    freshness: o.score.freshness,
    sources: o.coverage.map((c) => ({ publisher: c.publisher, url: c.url, sourceType: c.source_type, isPrimary: c.is_primary })),
    sectors: o.sectors.map((s) => sectorLabels.get(s) ?? s),
    geographies: o.geographies,
    geoFit: o.geoFitLabel,
    announcementType: o.announcementType ? ANNOUNCEMENT_TYPE_LABEL[o.announcementType] : null,
    whatWasAnnounced: a?.summary ?? "Not yet analysed — see the original source.",
    whyItMatters: a?.why_it_matters ?? "Pending analysis.",
    intentEvidence:
      partner?.level === "explicit"
        ? `Explicit partner request: ${partner.evidence ?? "see source"}`
        : partner?.level === "implied"
          ? `Works with NGOs, but no open call is stated. ${partner.evidence ?? ""}`.trim()
          : `The source does not establish that the company is seeking an NGO partner.${partner?.evidence ? " " + partner.evidence : ""}`,
    fundingSignal: a?.funding_signal?.present ? a.funding_signal.description : null,
    supportingClaims: o.claims
      .filter((c) => c.kind === "fact")
      .slice(0, 4)
      .map((c) => ({ claim: c.claim, excerpt: c.excerpt, verified: c.excerpt_verified })),
    score: o.score.total,
    scoreBreakdown: o.score.components.map((c) => ({ label: c.label, points: c.points, max: c.max, explanation: c.explanation })),
    primaryReason: o.score.primaryReason,
    verdict: o.score.verdict,
    confidence: o.score.confidence,
    evidenceStrength: o.score.evidenceStrength,
    uncertainties: o.missingInformation.slice(0, 6),
    nextAction: o.nextAction,
    outreachAngle: a?.outreach_angle ?? null,
    policyImplication: a?.policy_implication ?? null,
    reviewStatus: o.review?.status ?? null,
  };
}

/**
 * Builds digest sections from scored opportunities. No padding: sections only
 * contain items that meet their criteria, however few.
 */
export function buildDigestContent(
  opps: Opportunity[],
  settings: Settings,
  window: ReportingWindow,
  mode: "live" | "demo",
  failedSources: FailedSource[],
): DigestContent {
  const labels = new Map(settings.sectors.map((s) => [s.key, s.label]));
  const byScore = (a: Opportunity, b: Opportunity) => b.score.total - a.score.total;
  const open = opps.filter((o) => !CLOSED.has(o.review?.status ?? ""));
  const excludedByReview = opps.length - open.length;

  const high = open.filter((o) => o.score.priority === "high").sort(byScore);
  const highKept = high.slice(0, settings.digest.maxHighPriority);
  const monitor = [...high.slice(settings.digest.maxHighPriority), ...open.filter((o) => o.score.priority === "monitor")]
    .sort(byScore)
    .slice(0, settings.digest.maxMonitor);
  const policy = open.filter((o) => o.score.priority === "policy").sort(byScore);
  const background = open
    .filter((o) => o.score.priority === "background" && o.publishedAt && window.end.getTime() - new Date(o.publishedAt).getTime() < 60 * 86_400_000)
    .sort(byScore)
    .slice(0, 5);

  const mk = (list: Opportunity[], section: DigestSection) => list.map((o, i) => toPayload(o, section, i + 1, labels));
  const sections = {
    high_priority: mk(highKept, "high_priority"),
    monitor: mk(monitor, "monitor"),
    policy: mk(policy, "policy"),
    background: mk(background, "background"),
  };
  const consideredInWindow = opps.filter((o) => o.score.freshness === "fresh").length;
  let limitedEvidenceNote: string | null = null;
  if (sections.high_priority.length === 0) {
    limitedEvidenceNote = `No opportunity met the high-priority bar (score ≥ ${settings.thresholds.high}, fresh, credible intent, non-weak evidence) this week. Nothing has been padded in.`;
  } else if (sections.high_priority.length < 3) {
    limitedEvidenceNote = `Only ${sections.high_priority.length} opportunit${sections.high_priority.length === 1 ? "y" : "ies"} met the high-priority bar this week; the shortlist is intentionally short.`;
  }
  return {
    window: { start: window.start.toISOString(), end: window.end.toISOString(), days: window.days, timezone: window.timezone },
    mode,
    counts: {
      high_priority: sections.high_priority.length,
      monitor: sections.monitor.length,
      policy: sections.policy.length,
      background: sections.background.length,
      consideredInWindow,
      excludedByReview,
    },
    sections,
    failedSources,
    limitedEvidenceNote,
  };
}

export function allItems(c: DigestContent): DigestItemPayload[] {
  return [...c.sections.high_priority, ...c.sections.monitor, ...c.sections.policy, ...c.sections.background];
}
