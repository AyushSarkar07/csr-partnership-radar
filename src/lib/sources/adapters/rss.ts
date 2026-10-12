import { XMLParser } from "fast-xml-parser";
import { decodeEntities } from "../../text";
import { boundedGet, SourceFetchError } from "../http";
import type { AdapterResult, FetchLike, RawItem, SourceRecord } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  processEntities: false, // decoded explicitly; avoids entity-expansion surprises
  htmlEntities: false,
});

function text(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o["#cdata"] != null) return text(o["#cdata"]);
    if (o["#text"] != null) return text(o["#text"]);
  }
  return null;
}

function arr<T>(v: T | T[] | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

/** Parses RSS 2.0 or Atom XML into raw items. Exported for fixture tests. */
export function parseFeed(xml: string, fallbackPublisher: string): RawItem[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new SourceFetchError(`Unparseable XML: ${(e as Error).message}`);
  }
  const rss = doc.rss as Record<string, unknown> | undefined;
  const feed = doc.feed as Record<string, unknown> | undefined;

  if (rss?.channel) {
    const channel = arr(rss.channel as Record<string, unknown> | Record<string, unknown>[])[0] as Record<string, unknown>;
    const publisher = decodeEntities(text(channel.title) ?? fallbackPublisher);
    return arr(channel.item as Record<string, unknown>[]).map((it) => ({
      url: (text(it.link) ?? text(it.guid) ?? "").trim(),
      title: decodeEntities(text(it.title) ?? "").trim(),
      publishedRaw: text(it.pubDate) ?? text(it["dc:date"]) ?? null,
      publishedProvenance: "feed_pubdate" as const,
      description: text(it.description),
      contentHtml: text(it["content:encoded"]),
      publisher: (it.source ? text(it.source) : null) || publisher,
      categories: arr(it.category).map((c) => decodeEntities(text(c) ?? "")).filter(Boolean),
    }));
  }
  if (feed) {
    const publisher = decodeEntities(text(feed.title) ?? fallbackPublisher);
    return arr(feed.entry as Record<string, unknown>[]).map((e) => {
      const links = arr(e.link as Record<string, unknown>[]);
      const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      return {
        url: String(alt?.["@_href"] ?? "").trim(),
        title: decodeEntities(text(e.title) ?? "").trim(),
        publishedRaw: text(e.published) ?? text(e.updated) ?? null,
        publishedProvenance: "feed_pubdate" as const,
        description: text(e.summary),
        contentHtml: text(e.content),
        publisher,
        categories: arr(e.category as Record<string, unknown>[]).map((c) => String(c["@_term"] ?? "")).filter(Boolean),
      };
    });
  }
  throw new SourceFetchError("Not an RSS or Atom document");
}

export async function fetchRss(source: SourceRecord, fetchImpl?: FetchLike): Promise<AdapterResult> {
  if (!source.feed_url) throw new SourceFetchError("No feed URL configured");
  const xml = await boundedGet(source.feed_url, fetchImpl);
  return { items: parseFeed(xml, source.name) };
}
