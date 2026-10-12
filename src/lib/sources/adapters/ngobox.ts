import { decodeEntities, htmlToText } from "../../text";
import { boundedGet, SourceFetchError } from "../http";
import type { AdapterResult, FetchLike, RawItem, SourceRecord } from "../types";

/**
 * NGOBox RFP/EOI board (https://www.ngobox.org/rfp_eoi_listing.php): a public
 * HTML listing of RFPs, EOIs and tenders addressed to NGOs and agencies.
 * There is no RSS feed and no robots.txt (HTTP 404). We read the listing page only, never the
 * individual call pages. Each card exposes a title, the issuing organisation and
 * a deadline. No publication date is shown, so publishedRaw stays null.
 */
export function parseNgoboxListing(html: string, baseUrl = "https://www.ngobox.org/"): RawItem[] {
  const parts = html.split(/class="card-title"/);
  if (parts.length < 2) throw new SourceFetchError("NGOBox listing layout not recognised (no card titles found)");
  const items: RawItem[] = [];
  for (let i = 1; i < parts.length; i++) {
    const before = parts[i - 1];
    const href = /href="([^"]+)"\s*$/.exec(before.slice(-600))?.[1];
    const chunk = parts[i].slice(0, 4000);
    const title = htmlToText(/^>([\s\S]*?)<\/a>/.exec(chunk)?.[1] ?? "");
    const org = htmlToText(/class="p_balck"\s*>([\s\S]*?)<\/p>/.exec(chunk)?.[1] ?? "");
    const deadline = /Deadline:<\/strong>\s*([^<]{4,40})</.exec(chunk)?.[1]?.trim() ?? null;
    if (!href || !title || !/full_rfp_eoi_/.test(href)) continue;
    const url = new URL(decodeEntities(href), baseUrl).toString();
    items.push({
      url,
      title,
      publishedRaw: null,
      publishedProvenance: "feed_pubdate",
      deadlineRaw: deadline,
      description: `${title}. Issued by: ${org || "not stated"}.${deadline ? ` Deadline: ${deadline}.` : ""} Listed on the NGOBox RFP/EOI board (calls for proposals, EOIs and tenders addressed to NGOs and agencies).`,
      contentHtml: null,
      publisher: "NGOBox RFP/EOI board",
      categories: ["RFP/EOI", org].filter(Boolean),
    });
  }
  return items;
}

export async function fetchNgobox(source: SourceRecord, fetchImpl?: FetchLike): Promise<AdapterResult> {
  if (!source.feed_url) throw new SourceFetchError("No listing URL configured");
  const html = await boundedGet(source.feed_url, fetchImpl, "text/html");
  return { items: parseNgoboxListing(html, source.base_url.endsWith("/") ? source.base_url : source.base_url + "/") };
}
