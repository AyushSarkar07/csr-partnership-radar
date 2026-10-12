import registry from "../../../data/sources.json";
import type { Db } from "../db/types";
import { fetchGdelt } from "./adapters/gdelt";
import { fetchRss } from "./adapters/rss";
import type { AdapterResult, FetchLike, SourceRecord } from "./types";

export const REGISTRY = registry.sources as SourceRecord[];

export const ADAPTERS: Record<string, ((s: SourceRecord, f?: FetchLike) => Promise<AdapterResult>) | undefined> = {
  rss: fetchRss,
  gdelt_api: fetchGdelt,
  link_only: undefined,
};

/**
 * Upserts the file registry into the database. Definition fields come from the
 * file; operational fields (last fetch status) are preserved. `enabled` is only
 * set on first insert so toggles made in Settings survive re-seeding.
 */
export async function syncRegistry(db: Db) {
  for (const s of REGISTRY) {
    await db.query(
      `insert into sources (id, name, source_type, base_url, feed_url, retrieval_method, is_official, credibility,
         sector_relevance, geographic_coverage, enabled, access_limitations, config)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       on conflict (id) do update set name = excluded.name, source_type = excluded.source_type,
         base_url = excluded.base_url, feed_url = excluded.feed_url, retrieval_method = excluded.retrieval_method,
         is_official = excluded.is_official, credibility = excluded.credibility,
         sector_relevance = excluded.sector_relevance, geographic_coverage = excluded.geographic_coverage,
         access_limitations = excluded.access_limitations, config = excluded.config, updated_at = now()`,
      [s.id, s.name, s.source_type, s.base_url, s.feed_url, s.retrieval_method, s.is_official, s.credibility,
        s.sector_relevance, s.geographic_coverage, s.enabled, s.access_limitations, JSON.stringify(s.config ?? {})],
    );
  }
}

export async function listSources(db: Db): Promise<SourceRecord[]> {
  const rows = await db.query<SourceRecord & { credibility: string | number }>(
    "select * from sources order by enabled desc, is_official desc, name",
  );
  return rows.map((r) => ({ ...r, credibility: Number(r.credibility) }));
}
