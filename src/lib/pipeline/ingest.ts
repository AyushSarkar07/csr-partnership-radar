import type { Analysis } from "../ai/analysis";
import { classificationInputHash, classifyWithGemini, type ClassificationInput, type VerifiedClaim } from "../ai/classify";
import { GeminiError } from "../ai/gemini";
import { LIMITS } from "../config";
import type { Db } from "../db/types";
import { loadOpportunities, persistScores } from "../repo/opportunities";
import { loadSettings } from "../settings/store";
import type { Settings } from "../settings/schema";
import { listSources, ADAPTERS } from "../sources/registry";
import type { FetchLike, SourceRecord } from "../sources/types";
import { headlineSimilarity, normalizeCompany, normalizeHeadline, sha256 } from "../text";
import { reportingWindow } from "../time/window";
import { normalizeItem, prefilter, type NormalizedItem } from "./normalize";

export type Classifier = (
  input: ClassificationInput,
  settings: Settings,
) => Promise<{ analysis: Analysis; claims: VerifiedClaim[]; model: string }>;

export interface RefreshOptions {
  trigger: "manual" | "cron" | "test" | "collector";
  /**
   * Which sources to fetch. "cloud" skips sources marked config.runner = "local"
   * (they block datacenter IPs); "local" fetches only those; "all" fetches everything.
   * Default: "cloud" on Vercel, "all" elsewhere.
   */
  runner?: "cloud" | "local" | "all";
  runKey?: string;
  now?: Date;
  fetchImpl?: FetchLike;
  classify?: Classifier;
  maxAi?: number;
  /** Restrict to these source ids (tests). */
  sourceIds?: string[];
}

export interface SourceOutcome {
  sourceId: string;
  name: string;
  ok: boolean;
  error?: string;
  fetched: number;
  candidates: number;
  new: number;
  duplicates: number;
  skipped: Record<string, number>;
}

export interface RefreshResult {
  runId: string | null;
  skipped?: "already_ran";
  status: "succeeded" | "partial" | "failed";
  sources: SourceOutcome[];
  itemsFetched: number;
  itemsNew: number;
  itemsDuplicate: number;
  classified: number;
  aiFailed: number;
  aiPendingRemaining: number;
  aiNote?: string;
}

const DAY = 86_400_000;

export async function runRefresh(db: Db, opts: RefreshOptions): Promise<RefreshResult> {
  const now = opts.now ?? new Date();
  const { settings, version } = await loadSettings(db);

  // Idempotency for scheduled runs: one run per run_key.
  let runId: string | null = null;
  if (opts.runKey) {
    const ins = await db.query<{ id: string }>(
      `insert into fetch_runs (run_key, trigger, started_at) values ($1,$2,$3)
       on conflict (run_key) do nothing returning id`,
      [opts.runKey, opts.trigger, now],
    );
    if (!ins.length) {
      const prev = await db.query<{ id: string; status: string }>("select id, status from fetch_runs where run_key = $1", [opts.runKey]);
      // A previous failed attempt may be retried by reusing its row; a successful one is never repeated.
      if (prev[0] && prev[0].status !== "failed") {
        return { runId: prev[0].id, skipped: "already_ran", status: "succeeded", sources: [], itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, classified: 0, aiFailed: 0, aiPendingRemaining: 0 };
      }
      runId = prev[0]?.id ?? null;
      if (runId) await db.query("update fetch_runs set status='running', started_at=$2, finished_at=null, error=null where id=$1", [runId, now]);
    } else runId = ins[0].id;
  }
  if (!runId) {
    runId = (await db.query<{ id: string }>("insert into fetch_runs (trigger, started_at) values ($1,$2) returning id", [opts.trigger, now]))[0].id;
  }

  try {
    const runner = opts.runner ?? (process.env.VERCEL ? "cloud" : "all");
    let sources = (await listSources(db)).filter((s) => s.enabled && ADAPTERS[s.retrieval_method] && runsHere(s, runner));
    if (opts.sourceIds) sources = sources.filter((s) => opts.sourceIds!.includes(s.id));

    // Fetch all sources concurrently; one failure never affects the others.
    const settled = await Promise.allSettled(sources.map((s) => ADAPTERS[s.retrieval_method]!(s, opts.fetchImpl)));
    const outcomes: SourceOutcome[] = [];
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const r = settled[i];
      if (r.status === "rejected") {
        const msg = (r.reason as Error)?.message?.slice(0, 300) ?? "Unknown error";
        outcomes.push({ sourceId: s.id, name: s.name, ok: false, error: msg, fetched: 0, candidates: 0, new: 0, duplicates: 0, skipped: {} });
        await db.query("update sources set last_attempt_at=$2, last_error=$3, last_error_at=$2, updated_at=now() where id=$1", [s.id, now, msg]);
        continue;
      }
      const outcome = await ingestItems(db, s, r.value.items, settings, runId, now);
      outcomes.push(outcome);
      await db.query(
        "update sources set last_attempt_at=$2, last_success_at=$2, last_item_count=$3, last_error=null, updated_at=now() where id=$1",
        [s.id, now, r.value.items.length],
      );
    }

    const classify = opts.classify ?? defaultClassifier;
    const ai = await processPending(db, settings, classify, opts.maxAi ?? LIMITS.maxAiPerRun);

    // Re-score everything in the live set so persisted snapshots match current settings.
    const window = reportingWindow(now, settings.reportingWindowDays, settings.timezone);
    const opps = await loadOpportunities(db, "live", settings, window);
    await persistScores(db, opps, version);

    const okCount = outcomes.filter((o) => o.ok).length;
    const status: RefreshResult["status"] = !sources.length || okCount === 0 ? "failed" : okCount < sources.length ? "partial" : "succeeded";
    const totals = {
      fetched: sum(outcomes, "fetched"),
      candidates: sum(outcomes, "candidates"),
      new: sum(outcomes, "new"),
      dup: sum(outcomes, "duplicates"),
    };
    await db.query(
      `update fetch_runs set status=$2, finished_at=now(), sources_attempted=$3, sources_succeeded=$4,
         items_fetched=$5, items_candidate=$6, items_new=$7, items_duplicate=$8, items_classified=$9,
         items_ai_failed=$10, details=$11::jsonb, error=$12 where id=$1`,
      [runId, status, sources.length, okCount, totals.fetched, totals.candidates, totals.new, totals.dup,
        ai.classified, ai.failed, JSON.stringify({ sources: outcomes, ai }),
        status === "failed" ? (sources.length ? "All sources failed" : "No enabled sources") : null],
    );
    await db.query(
      "insert into audit_events (actor, action, entity, entity_id, details) values ($1,'refresh.run','fetch_run',$2,$3::jsonb)",
      [opts.trigger, runId, JSON.stringify({ status, ...totals, classified: ai.classified })],
    );
    return {
      runId, status, sources: outcomes, itemsFetched: totals.fetched, itemsNew: totals.new, itemsDuplicate: totals.dup,
      classified: ai.classified, aiFailed: ai.failed, aiPendingRemaining: ai.remaining, aiNote: ai.note,
    };
  } catch (err) {
    const msg = (err as Error).message.slice(0, 500);
    await db.query("update fetch_runs set status='failed', finished_at=now(), error=$2 where id=$1", [runId, msg]);
    throw err;
  }
}

function sum(rows: SourceOutcome[], k: "fetched" | "candidates" | "new" | "duplicates") {
  return rows.reduce((s, r) => s + r[k], 0);
}

/** Normalise → validate → pre-filter → lookback → dedupe → store. */
export async function ingestItems(
  db: Db,
  source: SourceRecord,
  items: import("../sources/types").RawItem[],
  settings: Settings,
  runId: string | null,
  now: Date,
): Promise<SourceOutcome> {
  const outcome: SourceOutcome = { sourceId: source.id, name: source.name, ok: true, fetched: items.length, candidates: 0, new: 0, duplicates: 0, skipped: {} };
  const skip = (r: string) => (outcome.skipped[r] = (outcome.skipped[r] ?? 0) + 1);
  const normalized: NormalizedItem[] = [];
  const seenInBatch = new Set<string>();

  for (const raw of items) {
    const n = normalizeItem(raw, source);
    if (!n.ok) { skip(n.reason); continue; }
    const item = n.item;
    if (seenInBatch.has(item.canonicalUrl)) { skip("duplicate_in_feed"); continue; }
    seenInBatch.add(item.canonicalUrl);
    if (item.publishedAt && now.getTime() - item.publishedAt.getTime() > LIMITS.ingestLookbackDays * DAY) { skip("older_than_lookback"); continue; }
    const pf = prefilter(item, settings, source);
    if (!pf.candidate) { skip(pf.reason); continue; }
    normalized.push(item);
  }
  outcome.candidates = normalized.length;
  if (!normalized.length) return outcome;

  // Layer 1: exact duplicates by canonical URL.
  const existing = new Set(
    (await db.query<{ canonical_url: string }>("select canonical_url from announcement_sources where canonical_url = any($1::text[])", [normalized.map((i) => i.canonicalUrl)])).map((r) => r.canonical_url),
  );
  for (const item of normalized) {
    if (existing.has(item.canonicalUrl)) { outcome.duplicates++; continue; }
    const clusterId = await findCluster(db, "live", item.title, item.publishedAt, now);
    await db.tx(async (q) => {
      let annId = clusterId;
      if (!annId) {
        annId = (
          await q.query<{ id: string }>(
            `insert into announcements (data_origin, verification_status, headline, normalized_headline, published_at,
               published_at_provenance, first_seen_at, primary_text, content_hash, deadline, deadline_provenance)
             values ('live','needs_verification',$1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
            [item.title, item.normalizedHeadline, item.publishedAt, item.provenance, now, item.text || item.excerpt, sha256(item.title + item.text),
              item.deadline, item.deadline ? "source_listing" : null],
          )
        )[0].id;
        outcome.new++;
      } else {
        outcome.duplicates++; // Layer 2: same event, different URL → supporting coverage
      }
      await q.query(
        `insert into announcement_sources (announcement_id, source_id, fetch_run_id, data_origin, url, canonical_url, publisher,
           headline, normalized_headline, published_at, published_at_provenance, retrieved_at, excerpt, raw_text, source_type, is_primary,
           credibility, is_official, deadline)
         values ($1,$2,$3,'live',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         on conflict (canonical_url) do nothing`,
        [annId, source.id, runId, item.url, item.canonicalUrl, item.publisher, item.title, item.normalizedHeadline,
          item.publishedAt, item.provenance, now, item.excerpt, item.text, source.source_type, !clusterId,
          item.credibility, item.isOfficial, item.deadline],
      );
    });
  }
  return outcome;
}

/** Layer 2 dedup: near-identical headline within ±3 days (pre-AI, entity-agnostic, strict threshold). */
export async function findCluster(db: Db, origin: "live" | "synthetic", title: string, publishedAt: Date | null, now: Date): Promise<string | null> {
  const anchor = publishedAt ?? now;
  const rows = await db.query<{ id: string; headline: string }>(
    `select id, headline from announcements where data_origin = $1
       and coalesce(published_at, first_seen_at) between $2 and $3`,
    [origin, new Date(anchor.getTime() - 3 * DAY), new Date(anchor.getTime() + 3 * DAY)],
  );
  let best: { id: string; sim: number } | null = null;
  for (const r of rows) {
    const sim = headlineSimilarity(title, r.headline);
    if (sim >= 0.6 && (!best || sim > best.sim)) best = { id: r.id, sim };
  }
  return best?.id ?? null;
}

const defaultClassifier: Classifier = async (input, settings) => {
  const r = await classifyWithGemini(input, settings);
  return { analysis: r.analysis, claims: r.claims, model: r.model };
};

interface PendingRow {
  id: string;
  headline: string;
  published_at: string | null;
  primary_text: string | null;
  ai_input_hash: string | null;
  ai_status: string;
  src_id: string | null;
  url: string;
  publisher: string | null;
  source_type: string;
  is_official: boolean;
  deadline: string | null;
}

/** Classifies pending/failed live announcements with Gemini Flash, bounded per run. */
export async function processPending(db: Db, settings: Settings, classify: Classifier, limit: number) {
  const rows = await db.query<PendingRow>(
    `select a.id, a.headline, a.published_at, a.primary_text, a.ai_input_hash, a.ai_status, a.deadline,
            s.id as src_id, s.url, s.publisher, s.source_type, s.is_official
       from announcements a
       join announcement_sources s on s.announcement_id = a.id and s.is_primary
      where a.data_origin = 'live' and a.ai_status in ('pending','failed') and a.ai_attempts < 3
      order by a.published_at desc nulls last
      limit $1`,
    [Math.max(0, limit)],
  );
  let classified = 0;
  let failed = 0;
  let note: string | undefined;
  let stop = false;

  const work = rows.map((r) => async () => {
    if (stop) return;
    const input: ClassificationInput = {
      headline: r.headline,
      publisher: r.publisher,
      sourceType: r.source_type,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      url: r.url,
      text: r.primary_text ?? "",
      deadline: r.deadline ? isoDate(r.deadline) : null,
    };
    const hash = classificationInputHash(input, settings);
    try {
      const out = await classify(input, settings);
      await saveAnalysis(db, r, out, hash);
      classified++;
    } catch (err) {
      const kind = err instanceof GeminiError ? err.kind : "error";
      const msg = `${kind}: ${(err as Error).message}`.slice(0, 400);
      if (kind === "missing_key") {
        // Do not burn attempts when the key is simply absent; keep items pending.
        stop = true;
        note = "GEMINI_API_KEY not configured — items stay pending and are shown as unclassified.";
        await db.query("update announcements set ai_error=$2, updated_at=now() where id=$1", [r.id, msg]);
        return;
      }
      failed++;
      if (kind === "rate_limited") stop = true; // back off for the rest of this run
      await db.query(
        "update announcements set ai_status='failed', ai_error=$2, ai_attempts=ai_attempts+1, updated_at=now() where id=$1",
        [r.id, msg],
      );
    }
  });
  await runPool(work, LIMITS.aiConcurrency);

  const remaining = Number(
    (await db.query<{ n: string }>("select count(*)::text as n from announcements where data_origin='live' and ai_status in ('pending','failed') and ai_attempts < 3"))[0].n,
  );
  return { attempted: rows.length, classified, failed, remaining, note };
}

async function saveAnalysis(
  db: Db,
  r: PendingRow,
  out: { analysis: Analysis; claims: VerifiedClaim[]; model: string },
  hash: string,
) {
  const a = out.analysis;
  const verifiedFact = out.claims.some((c) => c.kind === "fact" && c.excerptVerified);
  const verification = verifiedFact && r.published_at ? "verified" : "needs_verification";
  await db.tx(async (q) => {
    let companyId: string | null = null;
    if (a.company_name && normalizeCompany(a.company_name)) {
      companyId = (
        await q.query<{ id: string }>(
          `insert into companies (name, normalized_name, data_origin) values ($1,$2,'live')
           on conflict (normalized_name, data_origin) do update set name = companies.name returning id`,
          [a.company_name, normalizeCompany(a.company_name)],
        )
      )[0].id;
    }
    await q.query(
      `update announcements set ai_status='done', ai_model=$2, ai_error=null, ai_attempts=ai_attempts+1,
         ai_processed_at=now(), ai_input_hash=$3, is_relevant=$4, announcement_type=$5, sectors=$6, geographies=$7,
         initiative_name=$8, partner_signal=$9, analysis=$10::jsonb, company_id=$11, verification_status=$12, updated_at=now()
       where id=$1`,
      [r.id, out.model, hash, a.is_csr_relevant, a.announcement_type, a.sectors, a.geographies, a.initiative_name,
        a.implementation_partner_signal.level, JSON.stringify(a), companyId, verification],
    );
    await q.query("delete from evidence_claims where announcement_id=$1", [r.id]);
    for (const c of out.claims) {
      await q.query(
        `insert into evidence_claims (announcement_id, announcement_source_id, claim, kind, excerpt, excerpt_verified)
         values ($1,$2,$3,$4,$5,$6)`,
        [r.id, r.src_id, c.claim, c.kind, c.excerpt, c.excerptVerified],
      );
    }
  });
  await mergeDuplicates(db, r.id);
}

/**
 * Layers 3–4 dedup (post-AI): same company + event date within ±4 days +
 * overlapping headline or identical initiative name. Distinct announcements
 * from the same company (different initiative, low headline overlap) are kept apart.
 */
export async function mergeDuplicates(db: Db, id: string): Promise<string | null> {
  const self = (await db.query<{ id: string; company_id: string | null; published_at: string | null; headline: string; initiative_name: string | null; data_origin: string; first_seen_at: string }>(
    "select id, company_id, published_at, headline, initiative_name, data_origin, first_seen_at from announcements where id=$1", [id]))[0];
  if (!self?.company_id || !self.published_at) return null;
  const pub = new Date(self.published_at);
  const others = await db.query<{ id: string; headline: string; initiative_name: string | null; first_seen_at: string }>(
    `select id, headline, initiative_name, first_seen_at from announcements
      where data_origin=$1 and company_id=$2 and id<>$3 and published_at between $4 and $5`,
    [self.data_origin, self.company_id, id, new Date(pub.getTime() - 4 * DAY), new Date(pub.getTime() + 4 * DAY)],
  );
  const norm = (s: string | null) => (s ? normalizeHeadline(s) : "");
  const match = others.find(
    (o) => headlineSimilarity(o.headline, self.headline) >= 0.3 || (norm(o.initiative_name) && norm(o.initiative_name) === norm(self.initiative_name)),
  );
  if (!match) return null;
  // Keep the earlier-seen record as primary.
  const [keep, drop] = new Date(match.first_seen_at) <= new Date(self.first_seen_at) ? [match.id, id] : [id, match.id];
  await db.tx(async (q) => {
    await q.query("update announcement_sources set announcement_id=$1, is_primary=false where announcement_id=$2", [keep, drop]);
    await q.query("update evidence_claims set announcement_id=$1 where announcement_id=$2", [keep, drop]);
    await q.query("update opportunity_reviews set announcement_id=$1 where announcement_id=$2", [keep, drop]);
    await q.query("update digest_items set announcement_id=$1 where announcement_id=$2 and digest_id not in (select digest_id from digest_items where announcement_id=$1)", [keep, drop]);
    await q.query("delete from announcements where id=$1", [drop]);
    await q.query(
      "insert into audit_events (actor, action, entity, entity_id, details) values ('pipeline','announcement.merge','announcement',$1,$2::jsonb)",
      [keep, JSON.stringify({ merged: drop })],
    );
  });
  return keep;
}

async function runPool(tasks: Array<() => Promise<void>>, concurrency: number) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (i < tasks.length) await tasks[i++]();
  });
  await Promise.all(workers);
}

function isoDate(v: unknown): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

export function runsHere(s: SourceRecord, runner: "cloud" | "local" | "all"): boolean {
  const local = s.config?.runner === "local";
  return runner === "all" || (runner === "local" ? local : !local);
}
