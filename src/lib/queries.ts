import { isGeminiConfigured } from "./ai/gemini";
import { authConfigured } from "./auth";
import { geminiModel } from "./config";
import { DEMO_REFERENCE_TIME } from "./demo";
import type { Db } from "./db/types";
import type { DigestContent } from "./digest/build";
import type { DigestSummary } from "./digest/generate";
import { emailConfigStatus } from "./delivery/email";
import { applyFilters, type Filters } from "./repo/filters";
import { loadOpportunities, reviewHistory, type DataOrigin, type Opportunity } from "./repo/opportunities";
import { loadSettings } from "./settings/store";
import { listSources } from "./sources/registry";
import { reportingWindow, type ReportingWindow } from "./time/window";

export function referenceTime(mode: "live" | "demo", now = new Date()): Date {
  return mode === "demo" ? DEMO_REFERENCE_TIME : now;
}

export interface FetchRunRow {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  sources_attempted: number;
  sources_succeeded: number;
  items_fetched: number;
  items_candidate: number;
  items_new: number;
  items_duplicate: number;
  items_classified: number;
  items_ai_failed: number;
  error: string | null;
  details: { ai?: { note?: string; remaining?: number } } | null;
}

export interface DigestRow {
  id: string;
  digest_key: string;
  data_mode: "live" | "demo";
  window_start: string;
  window_end: string;
  timezone: string;
  trigger: string;
  status: string;
  generated_at: string;
  generation_count: number;
  summary: string | null;
  summary_source: string | null;
  ai_model: string | null;
  ai_error: string | null;
  content: DigestContent;
  delivery_status: string;
  delivery_channel: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
}

export function parseSummary(s: string | null): DigestSummary | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as DigestSummary;
  } catch {
    return null;
  }
}

export async function latestRun(db: Db): Promise<FetchRunRow | null> {
  return (await db.query<FetchRunRow>("select * from fetch_runs order by started_at desc limit 1"))[0] ?? null;
}

export async function lastSuccessfulRun(db: Db): Promise<FetchRunRow | null> {
  return (await db.query<FetchRunRow>("select * from fetch_runs where status in ('succeeded','partial') order by started_at desc limit 1"))[0] ?? null;
}

export async function latestDigest(db: Db, mode: "live" | "demo"): Promise<DigestRow | null> {
  return (await db.query<DigestRow>("select * from digests where data_mode=$1 order by generated_at desc limit 1", [mode]))[0] ?? null;
}

export async function getDigest(db: Db, id: string): Promise<DigestRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await db.query<DigestRow>("select * from digests where id=$1", [id]))[0] ?? null;
}

export async function listDigests(db: Db, limit = 20) {
  return db.query<Pick<DigestRow, "id" | "digest_key" | "data_mode" | "window_start" | "window_end" | "generated_at" | "delivery_status" | "generation_count" | "trigger">>(
    "select id, digest_key, data_mode, window_start, window_end, generated_at, delivery_status, generation_count, trigger from digests order by generated_at desc limit $1",
    [limit],
  );
}

export async function getDashboard(db: Db, filters: Filters) {
  const { settings, version, updatedAt } = await loadSettings(db);
  const origin: DataOrigin = filters.mode === "demo" ? "synthetic" : "live";
  const window = reportingWindow(referenceTime(filters.mode), filters.days, settings.timezone);
  const all = await loadOpportunities(db, origin, settings, window);
  const shown = applyFilters(all, filters);
  const sources = await listSources(db);
  const fetchable = sources.filter((s) => s.enabled && s.retrieval_method !== "link_only");
  const [run, okRun, digest, liveCount] = await Promise.all([
    latestRun(db),
    lastSuccessfulRun(db),
    latestDigest(db, filters.mode),
    db.query<{ n: number }>("select count(*)::int as n from announcements where data_origin='live'"),
  ]);
  const fresh = all.filter((o) => o.score.freshness === "fresh" || o.score.freshness === "open_call");
  const metrics = {
    freshAnnouncements: fresh.filter((o) => o.isRelevant !== false).length,
    highPriority: all.filter((o) => o.score.priority === "high").length,
    explicitRequests: fresh.filter((o) => o.partnerSignal === "explicit").length,
    policy: all.filter((o) => o.score.priority === "policy").length,
    sourcesOk: fetchable.filter((s) => s.last_success_at && !s.last_error).length,
    sourcesEnabled: fetchable.length,
    aiPending: all.filter((o) => o.aiStatus === "pending" || o.aiStatus === "failed").length,
    verified: all.filter((o) => o.verificationStatus === "verified").length,
    unknownDates: all.filter((o) => o.score.freshness === "unknown").length,
    totalStored: all.length,
    liveTotal: liveCount[0].n,
  };
  const sectorCounts = settings.sectors.map((s) => ({
    key: s.key,
    label: s.label,
    count: fresh.filter((o) => o.sectors.includes(s.key) && o.isRelevant !== false).length,
  }));
  return { settings, settingsVersion: version, settingsUpdatedAt: updatedAt, window, all, shown, sources, run, okRun, digest, metrics, sectorCounts };
}

export async function getOpportunityDetail(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = (await db.query<{ data_origin: DataOrigin; company_id: string | null }>("select data_origin, company_id from announcements where id=$1", [id]))[0];
  if (!row) return null;
  const { settings } = await loadSettings(db);
  const mode = row.data_origin === "synthetic" ? "demo" : "live";
  const window: ReportingWindow = reportingWindow(referenceTime(mode), settings.reportingWindowDays, settings.timezone);
  const [opp] = await loadOpportunities(db, row.data_origin, settings, window, [id]);
  const history = await reviewHistory(db, id);
  let related: Array<{ id: string; headline: string; published_at: string | null }> = [];
  if (row.company_id) {
    related = await db.query("select id, headline, published_at from announcements where company_id=$1 and id<>$2 order by published_at desc nulls last limit 5", [row.company_id, id]);
  }
  return { opp: opp as Opportunity, history, related, settings, window, mode };
}

export async function getHealth(db: Db | null) {
  const checks = {
    gemini: { configured: isGeminiConfigured(), model: safeModel() },
    writeAuth: authConfigured(),
    cronSecret: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16),
  };
  if (!db) return { ok: false, database: { configured: false }, ...checks };
  try {
    const [mig, counts, run] = await Promise.all([
      db.query<{ name: string }>("select name from schema_migrations order by name"),
      db.query<{ live: number; synthetic: number; digests: number }>(
        "select (select count(*)::int from announcements where data_origin='live') as live, (select count(*)::int from announcements where data_origin='synthetic') as synthetic, (select count(*)::int from digests) as digests",
      ),
      latestRun(db),
    ]);
    const { settings, persisted } = await loadSettings(db);
    return {
      ok: true,
      database: { configured: true, connected: true, migrations: mig.map((m) => m.name) },
      records: counts[0],
      settingsPersisted: persisted,
      email: emailConfigStatus(settings.digest.emailEnabled, settings.digest.emailTo),
      lastRun: run ? { status: run.status, startedAt: run.started_at, finishedAt: run.finished_at, trigger: run.trigger } : null,
      ...checks,
    };
  } catch (err) {
    return { ok: false, database: { configured: true, connected: false, error: (err as Error).message.slice(0, 120) }, ...checks };
  }
}

function safeModel() {
  try {
    return geminiModel();
  } catch (e) {
    return `invalid: ${(e as Error).message}`;
  }
}
