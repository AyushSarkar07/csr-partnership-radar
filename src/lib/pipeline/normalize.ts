import { z } from "zod";
import { LIMITS } from "../config";
import { normGeo, stateOf } from "../geo";
import type { Settings } from "../settings/schema";
import type { RawItem, SourceRecord } from "../sources/types";
import { canonicalizeUrl, htmlToText, normalizeHeadline, stripFeedBoilerplate, truncate } from "../text";
import { parseFeedDate } from "../time/window";

export interface NormalizedItem {
  sourceId: string;
  sourceType: string;
  isOfficial: boolean;
  credibility: number;
  url: string;
  canonicalUrl: string;
  title: string;
  normalizedHeadline: string;
  publishedAt: Date | null;
  provenance: "feed_pubdate" | "api_seendate" | "unknown";
  publisher: string | null;
  text: string;
  excerpt: string;
  categories: string[];
}

const itemSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().min(8).max(500),
});

export type NormalizeOutcome = { ok: true; item: NormalizedItem } | { ok: false; reason: string };

export function normalizeItem(raw: RawItem, source: SourceRecord): NormalizeOutcome {
  const valid = itemSchema.safeParse({ url: raw.url, title: raw.title });
  if (!valid.success) return { ok: false, reason: "invalid_url_or_title" };
  const canonicalUrl = canonicalizeUrl(raw.url);
  if (!canonicalUrl) return { ok: false, reason: "invalid_url" };

  const publishedAt = parseFeedDate(raw.publishedRaw);
  const body = stripFeedBoilerplate(htmlToText(raw.contentHtml || raw.description || ""));
  const description = stripFeedBoilerplate(htmlToText(raw.description || ""));
  return {
    ok: true,
    item: {
      sourceId: source.id,
      sourceType: source.source_type,
      isOfficial: source.is_official,
      credibility: Number(source.credibility),
      url: raw.url.trim(),
      canonicalUrl,
      title: htmlToText(raw.title),
      normalizedHeadline: normalizeHeadline(raw.title),
      publishedAt,
      provenance: publishedAt ? raw.publishedProvenance : "unknown",
      publisher: raw.publisher?.trim() || source.name,
      text: truncate(body, LIMITS.storedTextChars),
      excerpt: truncate(description || body, 400),
      categories: raw.categories.slice(0, 15),
    },
  };
}

const CSR_TERMS = [
  "csr", "corporate social responsibility", "philanthrop", "social impact", "ngo", "ngos",
  "implementation partner", "non-profit", "nonprofit", "grants", "expression of interest", "call for proposal",
  "request for proposal", "social responsibility", "community initiative", "sustainability report",
  "foundation's", "foundation has", "foundation will", "foundation launched", "foundation announced",
];
const POLICY_TERMS = [
  "csr rules", "csr rule", "csr norms", "csr amendment", "section 135", "schedule vii", "ministry of corporate affairs",
  "csr spend", "csr spending", "csr expenditure", "csr policy", "csr obligation", "csr-1", "unspent csr", "csr fund",
];

function includesAny(hay: string, terms: string[]) {
  return terms.find((t) => (t.length <= 4 ? new RegExp(`\\b${t}\\b`).test(hay) : hay.includes(t)));
}

const INDIA_TERMS = (() => {
  const s = new Set<string>(["india", "indian"]);
  for (const g of [
    "maharashtra", "karnataka", "gujarat", "tamil nadu", "telangana", "kerala", "delhi", "uttar pradesh",
    "west bengal", "rajasthan", "madhya pradesh", "bihar", "odisha", "assam", "haryana", "punjab", "jharkhand",
    "andhra pradesh", "chhattisgarh", "uttarakhand", "goa",
  ]) s.add(g);
  return [...s];
})();

/**
 * Deterministic relevance pre-filter that runs before any Gemini call so we
 * only spend AI budget on plausible CSR items.
 */
export function prefilter(item: NormalizedItem, settings: Settings, source: SourceRecord): { candidate: boolean; reason: string } {
  const hay = `${item.title}\n${item.categories.join(" ")}\n${item.text.slice(0, 4000)}`.toLowerCase();
  // Publication names containing "CSR" must not satisfy the CSR-term check on their own.
  const hayNoBrand = hay.replace(/the csr journal|india csr|indiacsr|csr journal/g, " ");
  if (source.config?.requireIndiaMention) {
    const india = INDIA_TERMS.some((t) => hay.includes(t)) || hay.split(/\W+/).some((w) => stateOf(normGeo(w)) !== null);
    if (!india) return { candidate: false, reason: "no_india_mention" };
  }
  const policy = includesAny(hayNoBrand, POLICY_TERMS);
  if (policy) return { candidate: true, reason: `policy_term:${policy}` };
  const csr = includesAny(hayNoBrand, CSR_TERMS);
  const sectorTerms = settings.sectors.flatMap((s) => [s.label.toLowerCase(), ...s.keywords.map((k) => k.toLowerCase())]);
  const sector = includesAny(hay, sectorTerms);
  // Partner-call listings are inherently about funding; require a sector term only.
  if (source.source_type === "partner_calls" && sector) return { candidate: true, reason: `partner_call+${sector}` };
  if (csr && sector) return { candidate: true, reason: `csr:${csr}+sector:${sector}` };
  return { candidate: false, reason: csr ? "no_sector_term" : "no_csr_term" };
}
