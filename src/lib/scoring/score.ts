import type { AnnouncementType } from "../ai/analysis";
import { GEO_FIT_FRACTION, GEO_FIT_LABEL, geographicFit, type GeoFit } from "../geo";
import type { Settings } from "../settings/schema";
import { deadlineEnd, freshness, hoursBetween, type Freshness, type ReportingWindow } from "../time/window";

/**
 * Deterministic, explainable 100-point opportunity score. No AI is used here:
 * Gemini supplies classifications; this code turns them into numbers.
 */

export interface ScoringInput {
  isRelevant: boolean | null;
  announcementType: AnnouncementType | null;
  partnerSignal: "explicit" | "implied" | "none" | null;
  sectors: string[];
  otherSectors: string[];
  geographies: string[];
  publishedAt: Date | null;
  publishedAtProvenance: string;
  sources: Array<{ credibility: number; isOfficial: boolean; publisher: string | null }>;
  claims: Array<{ kind: "fact" | "interpretation" | "unknown"; excerptVerified: boolean }>;
  aiStatus: string;
  fundingSignal: boolean;
  /** Application deadline stated by the source (YYYY-MM-DD), never AI-inferred. */
  deadline?: string | null;
}

export type Priority = "high" | "monitor" | "policy" | "background" | "low";
export type Confidence = "high" | "medium" | "low";
export type EvidenceStrength = "strong" | "moderate" | "weak";

export interface ComponentScore {
  key: "sector" | "intent" | "recency" | "geography" | "evidence";
  label: string;
  points: number;
  max: number;
  fraction: number;
  explanation: string;
}

export interface ScoreResult {
  total: number;
  components: ComponentScore[];
  priority: Priority;
  verdict: string;
  primaryReason: string;
  confidence: Confidence;
  confidenceReasons: string[];
  evidenceStrength: EvidenceStrength;
  freshness: Freshness;
  geoFit: GeoFit;
  flags: string[];
}

export const INTENT_FRACTION: Record<AnnouncementType, number> = {
  explicit_partner_request: 1,
  new_initiative: 0.76,
  increased_allocation: 0.7,
  programme_expansion: 0.62,
  policy_change: 0.5,
  general_csr: 0.28,
  historical_activity: 0.12,
  not_csr: 0,
};

const PRIORITY_FRACTION = { high: 1, medium: 0.7, low: 0.45 } as const;

export const PRIORITY_VERDICT: Record<Priority, string> = {
  high: "Yes — worth a call this week",
  monitor: "Not yet — monitor and verify",
  policy: "Brief the team — policy development",
  background: "Background context only",
  low: "No — not a priority",
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function scoreOpportunity(input: ScoringInput, settings: Settings, window: ReportingWindow): ScoreResult {
  const w = settings.weights;
  const flags: string[] = [];
  const relevant = input.isRelevant !== false && input.announcementType !== "not_csr";

  // 1. Sector relevance --------------------------------------------------
  const configured = new Map(settings.sectors.map((s) => [s.key, s]));
  const matched = input.sectors.filter((k) => configured.has(k));
  const excludedHit = input.otherSectors.some((o) =>
    settings.excludedSectors.some((e) => e.toLowerCase() === o.toLowerCase()),
  );
  let sectorFraction = 0;
  for (const k of matched) sectorFraction = Math.max(sectorFraction, PRIORITY_FRACTION[configured.get(k)!.priority]);
  if (!relevant) sectorFraction = 0;
  if (excludedHit && !matched.length) {
    sectorFraction = 0;
    flags.push("excluded_sector");
  }
  const sectorExplanation = matched.length
    ? `Matches ${matched.map((k) => configured.get(k)!.label).join(", ")}`
    : input.otherSectors.length
      ? `Outside focus sectors (${input.otherSectors.join(", ")})`
      : "No focus sector identified";

  // 2. Evidence of current intent ------------------------------------------
  const type = input.announcementType;
  let intentFraction = type ? INTENT_FRACTION[type] : 0;
  if (type === "explicit_partner_request" && input.partnerSignal !== "explicit") {
    intentFraction = 0.76; // treat as a new initiative until an explicit invitation is quoted
    flags.push("partner_request_unconfirmed");
  }
  if (type !== "explicit_partner_request" && input.partnerSignal === "implied") intentFraction += 0.06;
  if (input.fundingSignal && type !== "not_csr" && type !== "historical_activity") intentFraction += 0.04;
  intentFraction = Math.min(1, relevant ? intentFraction : 0);
  const intentExplanation = !type
    ? "Not yet analysed"
    : input.partnerSignal === "explicit"
      ? "Explicitly seeking NGO / implementation partners"
      : `${typeLabel(type)}${input.partnerSignal === "implied" ? "; works with NGOs (no open call stated)" : "; does not establish that it is seeking an NGO"}`;

  // 3. Recency ----------------------------------------------------------------
  const pubFresh = freshness(input.publishedAt, window);
  const isExplicitCall = type === "explicit_partner_request" && input.partnerSignal === "explicit";
  const deadlineOpen = Boolean(input.deadline && deadlineEnd(input.deadline).getTime() >= window.end.getTime());
  const deadlinePassed = Boolean(input.deadline && !deadlineOpen);
  // An explicit call whose source-stated deadline is still ahead is current even
  // when the listing shows no publication date (or the post is older than the window).
  const openCall = isExplicitCall && deadlineOpen && pubFresh !== "fresh";
  const fresh: Freshness = openCall ? "open_call" : pubFresh;
  if (deadlinePassed) flags.push("deadline_passed");
  let recencyFraction = 0;
  let recencyExplanation: string;
  if (openCall) {
    recencyFraction = 0.75;
    recencyExplanation = `Open call — application deadline ${input.deadline} (stated by source)${pubFresh === "unknown" ? "; publication date not shown" : ""}`;
    if (pubFresh === "unknown") flags.push("date_unknown");
  } else if (fresh === "unknown") {
    recencyFraction = settings.recency.unknownDateFraction;
    recencyExplanation = "Publication date could not be verified";
    flags.push("date_unknown");
  } else if (fresh === "future") {
    recencyFraction = settings.recency.unknownDateFraction;
    recencyExplanation = "Publication date is in the future — treated as unverified";
    flags.push("date_future");
  } else if (fresh === "stale") {
    recencyExplanation = `Outside the ${window.days}-day window`;
  } else {
    const h = hoursBetween(input.publishedAt!, window.end);
    if (h <= settings.recency.topHours) recencyFraction = 1;
    else if (h <= settings.recency.midHours) recencyFraction = 0.75;
    else recencyFraction = 0.5;
    recencyExplanation = h < 48 ? `Published ${Math.max(0, Math.round(h))}h before the window end` : `Published ${Math.round(h / 24)} days before the window end`;
  }
  if (input.publishedAtProvenance === "api_seendate" && fresh === "fresh") {
    recencyFraction *= 0.85;
    recencyExplanation += " (date = first seen by news index, approximate)";
  }

  // 4. Geographic & programme fit -------------------------------------------
  const geo = geographicFit(input.geographies, {
    operating: settings.operatingGeographies,
    expansion: settings.expansionGeographies,
    excluded: settings.excludedGeographies,
  });
  const geoFraction = GEO_FIT_FRACTION[geo.fit];
  const geoExplanation = GEO_FIT_LABEL[geo.fit] + (geo.matched.length ? ` (${geo.matched.join(", ")})` : "");

  // 5. Evidence quality & source credibility ----------------------------------
  const bestCred = input.sources.reduce((m, s) => Math.max(m, s.credibility), 0);
  const publishers = new Set(input.sources.map((s) => (s.publisher ?? "").toLowerCase()).filter(Boolean));
  const facts = input.claims.filter((c) => c.kind === "fact");
  const verifiedFacts = facts.filter((c) => c.excerptVerified).length;
  const unsupported = facts.length - verifiedFacts;
  let evidenceFraction =
    bestCred * 0.6 +
    Math.min(Math.max(publishers.size - 1, 0), 2) * 0.1 +
    (facts.length ? (verifiedFacts / facts.length) * 0.2 : 0) -
    Math.min(unsupported * 0.1, 0.3);
  if (verifiedFacts === 0) {
    evidenceFraction -= 0.15;
    flags.push("no_verified_facts");
  }
  if (unsupported > 0) flags.push("unsupported_claims");
  evidenceFraction = Math.max(0, Math.min(1, evidenceFraction));
  const officialSource = input.sources.some((s) => s.isOfficial);
  const evidenceStrength: EvidenceStrength =
    evidenceFraction >= 0.7 ? "strong" : evidenceFraction >= 0.45 ? "moderate" : "weak";
  if (evidenceStrength === "weak") flags.push("weak_evidence");
  const evidenceExplanation = `${officialSource ? "Official source" : "Secondary source"}; ${publishers.size} publisher${publishers.size === 1 ? "" : "s"}; ${verifiedFacts}/${facts.length} factual claims verified against source text`;

  const components: ComponentScore[] = [
    comp("sector", "Sector relevance", sectorFraction, w.sector, sectorExplanation),
    comp("intent", "Evidence of current intent", intentFraction, w.intent, intentExplanation),
    comp("recency", "Recency", recencyFraction, w.recency, recencyExplanation),
    comp("geography", "Geographic & programme fit", geoFraction, w.geography, geoExplanation),
    comp("evidence", "Evidence quality", evidenceFraction, w.evidence, evidenceExplanation),
  ];
  const total = Math.max(0, Math.min(100, Math.round(components.reduce((s, c) => s + c.points, 0))));

  // Priority (decision support, not a funding prediction) --------------------
  const outsideGeography = geo.fit === "mismatch" || geo.fit === "excluded";
  if (outsideGeography) flags.push("outside_geography");
  let priority: Priority;
  if (type === "policy_change" && relevant) priority = fresh === "stale" ? "background" : "policy";
  else if (!relevant || sectorFraction === 0) priority = "low";
  else if (fresh === "stale" || type === "historical_activity" || (deadlinePassed && isExplicitCall)) priority = "background";
  else if (
    total >= settings.thresholds.high &&
    (fresh === "fresh" || fresh === "open_call") &&
    intentFraction >= 0.6 &&
    evidenceStrength !== "weak" &&
    !outsideGeography
  )
    priority = "high";
  else if (total >= settings.thresholds.monitor) priority = "monitor";
  else priority = "low";

  // Confidence ----------------------------------------------------------------
  const confidenceReasons: string[] = [];
  let c = 0;
  if (pubFresh === "fresh" || pubFresh === "stale") {
    c++;
    confidenceReasons.push("publication date verified from source metadata");
  } else if (openCall) {
    c++;
    confidenceReasons.push("application deadline stated by the source (publication date not shown)");
  } else confidenceReasons.push("publication date unknown");
  if (officialSource || publishers.size >= 2) {
    c++;
    confidenceReasons.push(officialSource ? "official source" : "corroborated by multiple publishers");
  } else confidenceReasons.push("single secondary source");
  if (verifiedFacts >= 1) {
    c++;
    confidenceReasons.push(`${verifiedFacts} claim(s) quoted verbatim from the source`);
  } else confidenceReasons.push("no claim could be verified against source text");
  if (input.aiStatus === "done" || input.aiStatus === "fixture") c++;
  else confidenceReasons.push("analysis not yet complete");
  if (unsupported > 0) c--;
  const confidence: Confidence = c >= 4 ? "high" : c >= 2 ? "medium" : "low";

  return {
    total,
    components,
    priority,
    verdict: PRIORITY_VERDICT[priority],
    primaryReason: primaryReason(priority, type, input.partnerSignal, components, fresh, geo.fit),
    confidence,
    confidenceReasons,
    evidenceStrength,
    freshness: fresh,
    geoFit: geo.fit,
    flags,
  };
}

function comp(key: ComponentScore["key"], label: string, fraction: number, max: number, explanation: string): ComponentScore {
  const f = Math.max(0, Math.min(1, fraction));
  return { key, label, fraction: round1(f * 100) / 100, max, points: round1(f * max), explanation };
}

function typeLabel(t: AnnouncementType): string {
  return {
    explicit_partner_request: "Partner request",
    new_initiative: "New initiative",
    programme_expansion: "Programme expansion",
    increased_allocation: "Increased allocation",
    policy_change: "Policy change",
    general_csr: "General CSR activity",
    historical_activity: "Historical activity",
    not_csr: "Not CSR",
  }[t];
}

function primaryReason(
  priority: Priority,
  type: AnnouncementType | null,
  partner: ScoringInput["partnerSignal"],
  components: ComponentScore[],
  fresh: Freshness,
  geoFit: GeoFit,
): string {
  if (priority === "low") {
    const weakest = [...components].sort((a, b) => a.fraction - b.fraction)[0];
    return `Low priority: ${weakest.label.toLowerCase()} is weak (${weakest.explanation}).`;
  }
  if (priority === "policy") return "Regulatory development that may change how companies deploy CSR funds.";
  if (priority === "background") return fresh === "stale" ? "Relevant but outside the reporting window — background only." : type === "explicit_partner_request" ? "Call for proposals whose deadline has passed." : "Historical activity with no current signal.";
  if (partner === "explicit") return fresh === "open_call" ? "Open call for implementation partners in a focus sector — deadline still ahead." : "Company is explicitly seeking implementation partners in a focus sector.";
  const parts: string[] = [];
  if (type) parts.push(typeLabel(type).toLowerCase());
  if (fresh === "fresh") parts.push("announced within the window");
  if (fresh === "unknown") parts.push("date unverified");
  if (geoFit === "operating" || geoFit === "operating_state") parts.push("in an operating geography");
  else if (geoFit === "expansion") parts.push("in a target expansion geography");
  return `${capitalise(parts.join(", "))}.`;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
