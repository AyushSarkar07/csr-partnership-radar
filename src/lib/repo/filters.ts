import { ANNOUNCEMENT_TYPES } from "../ai/analysis";
import { REVIEW_STATUSES, type Opportunity } from "./opportunities";

export interface Filters {
  mode: "live" | "demo";
  days: number;
  freshness: "window" | "fresh" | "all";
  sector: string;
  company: string;
  geography: string;
  type: string;
  priority: string;
  evidence: string;
  sourceType: string;
  status: string;
  verification: string;
  showLow: boolean;
  sort: "score" | "date" | "company";
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(p: Params, k: string): string {
  const v = p instanceof URLSearchParams ? p.get(k) : p[k];
  return (Array.isArray(v) ? v[0] : v ?? "").toString().trim().slice(0, 80);
}

export function parseFilters(p: Params, defaults: { mode: "live" | "demo"; days: number }): Filters {
  const days = Number(get(p, "days"));
  const pick = <T extends string>(v: string, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
  return {
    mode: pick(get(p, "mode"), ["live", "demo"] as const, defaults.mode),
    days: Number.isInteger(days) && days >= 1 && days <= 60 ? days : defaults.days,
    freshness: pick(get(p, "freshness"), ["window", "fresh", "all"] as const, "window"),
    sector: get(p, "sector"),
    company: get(p, "company"),
    geography: get(p, "geography"),
    type: pick(get(p, "type"), ["", ...ANNOUNCEMENT_TYPES] as const, ""),
    priority: pick(get(p, "priority"), ["", "high", "monitor", "policy", "background", "low"] as const, ""),
    evidence: pick(get(p, "evidence"), ["", "strong", "moderate", "weak"] as const, ""),
    sourceType: get(p, "sourceType"),
    status: pick(get(p, "status"), ["", "unreviewed", ...REVIEW_STATUSES] as const, ""),
    verification: pick(get(p, "verification"), ["", "verified", "needs_verification"] as const, ""),
    showLow: get(p, "showLow") === "1",
    sort: pick(get(p, "sort"), ["score", "date", "company"] as const, "score"),
  };
}

export function applyFilters(opps: Opportunity[], f: Filters): Opportunity[] {
  const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();
  const out = opps.filter((o) => {
    if (f.freshness === "fresh" && o.score.freshness !== "fresh" && o.score.freshness !== "open_call") return false;
    if (f.freshness === "window" && !(o.score.freshness === "fresh" || o.score.freshness === "open_call" || o.score.freshness === "unknown" || o.score.freshness === "future")) return false;
    if (f.sector && !o.sectors.includes(f.sector)) return false;
    if (f.company && !lc(o.company).includes(lc(f.company)) && !lc(o.headline).includes(lc(f.company))) return false;
    if (f.geography && !o.geographies.some((g) => lc(g).includes(lc(f.geography)))) return false;
    if (f.type && o.announcementType !== f.type) return false;
    if (f.priority) {
      if (o.score.priority !== f.priority) return false;
    } else if (!f.showLow && o.score.priority === "low") return false;
    if (f.evidence && o.score.evidenceStrength !== f.evidence) return false;
    if (f.sourceType && !o.coverage.some((c) => c.source_type === f.sourceType)) return false;
    if (f.status === "unreviewed" && o.review) return false;
    if (f.status && f.status !== "unreviewed" && o.review?.status !== f.status) return false;
    if (f.verification && o.verificationStatus !== f.verification) return false;
    return true;
  });
  const t = (o: Opportunity) => (o.publishedAt ? new Date(o.publishedAt).getTime() : 0);
  out.sort((a, b) => {
    if (f.sort === "date") return t(b) - t(a) || b.score.total - a.score.total;
    if (f.sort === "company") return lc(a.company).localeCompare(lc(b.company)) || b.score.total - a.score.total;
    return b.score.total - a.score.total || t(b) - t(a);
  });
  return out;
}

export function filtersToQuery(f: Partial<Filters>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === "" || v === undefined || v === false) continue;
    q.set(k, v === true ? "1" : String(v));
  }
  return q.toString();
}
