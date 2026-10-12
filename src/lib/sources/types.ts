export type SourceType =
  | "corporate_official"
  | "annual_report"
  | "business_news"
  | "csr_specialist_news"
  | "government"
  | "partner_calls"
  | "news_api"
  | "regulatory_news";

export const SOURCE_TYPE_LABEL: Record<SourceType | "synthetic", string> = {
  corporate_official: "Official company source",
  annual_report: "Annual / sustainability report",
  business_news: "Business news",
  csr_specialist_news: "CSR specialist news",
  government: "Government / regulator",
  partner_calls: "Grant & partner-call listing",
  news_api: "News index API",
  regulatory_news: "Regulatory / legal news",
  synthetic: "Synthetic",
};

export interface SourceRecord {
  id: string;
  name: string;
  source_type: SourceType;
  base_url: string;
  feed_url: string | null;
  retrieval_method: "rss" | "gdelt_api" | "ngobox_html" | "link_only";
  is_official: boolean;
  credibility: number;
  sector_relevance: string[];
  geographic_coverage: string;
  enabled: boolean;
  access_limitations: string | null;
  config: Record<string, unknown>;
  last_attempt_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
  last_error_at?: string | null;
  last_item_count?: number | null;
}

/** One item as returned by a source adapter, before normalisation. */
export interface RawItem {
  url: string;
  title: string;
  publishedRaw: string | null;
  publishedProvenance: "feed_pubdate" | "api_seendate";
  /** Application deadline exactly as printed by the source (structured field, never AI-inferred). */
  deadlineRaw?: string | null;
  description: string | null;
  contentHtml: string | null;
  publisher: string | null;
  categories: string[];
}

export interface AdapterResult {
  items: RawItem[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
