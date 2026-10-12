import { boundedGet, SourceFetchError } from "../http";
import type { AdapterResult, FetchLike, RawItem, SourceRecord } from "../types";

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

/** Parses a GDELT DOC 2.0 artlist JSON response. Exported for fixture tests. */
export function parseGdelt(body: string): RawItem[] {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) {
    // GDELT answers rate-limited requests with a plain-text notice and HTTP 200.
    throw new SourceFetchError(`GDELT did not return JSON: ${trimmed.slice(0, 120)}`);
  }
  let json: { articles?: GdeltArticle[] };
  try {
    json = JSON.parse(trimmed);
  } catch {
    throw new SourceFetchError("GDELT returned malformed JSON");
  }
  return (json.articles ?? []).map((a) => ({
    url: a.url ?? "",
    title: (a.title ?? "").trim(),
    publishedRaw: a.seendate ?? null,
    publishedProvenance: "api_seendate" as const,
    description: null,
    contentHtml: null,
    publisher: a.domain ?? null,
    categories: [],
  }));
}

export async function fetchGdelt(source: SourceRecord, fetchImpl?: FetchLike): Promise<AdapterResult> {
  const query = String(source.config.query ?? "");
  if (!query) throw new SourceFetchError("No GDELT query configured");
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    timespan: "7d",
    sort: "datedesc",
    maxrecords: String(Math.min(Number(source.config.maxrecords ?? 50), 75)),
  });
  const body = await boundedGet(`${source.feed_url}?${params}`, fetchImpl, "application/json");
  return { items: parseGdelt(body) };
}
