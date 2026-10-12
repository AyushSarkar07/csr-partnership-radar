import { sourceState } from "@/components/SourceHealth";
import { SourceToggle } from "@/components/SourceToggle";
import { Card, Pill } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { latestRun } from "@/lib/queries";
import { loadSettings } from "@/lib/settings/store";
import { listSources } from "@/lib/sources/registry";
import { SOURCE_TYPE_LABEL } from "@/lib/sources/types";
import { formatDateTime } from "@/lib/time/window";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const db = getDb();
  const [sources, { settings }, run] = await Promise.all([listSources(db), loadSettings(db), latestRun(db)]);
  const tz = settings.timezone;
  const perSource = new Map(((run?.details as { sources?: Array<{ sourceId: string; candidates: number; new: number; duplicates: number; skipped: Record<string, number> }> } | null)?.sources ?? []).map((s) => [s.sourceId, s]));
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Source registry</h1>
        <p className="text-ink-2 text-sm max-w-3xl">
          Every source the radar checks, with how it is retrieved and what limits apply. Sources blocked by robots.txt or returning HTTP 403 are kept here, disabled, so the gap is visible. Feed URLs come from this registry only. The app never fetches user-supplied URLs.
        </p>
        {run && <p className="mt-1 text-xs text-ink-3">Last run: {run.status} at {formatDateTime(run.started_at, tz)} ({run.trigger}) — {run.sources_succeeded}/{run.sources_attempted} sources OK, {run.items_fetched} items fetched, {run.items_new} new.</p>}
      </div>
      <div className="grid gap-3">
        {sources.map((s) => {
          const st = sourceState(s);
          const r = perSource.get(s.id);
          return (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Pill className={st.cls}>{st.label}</Pill>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-ink-3 flex flex-wrap gap-x-3">
                    <span>{SOURCE_TYPE_LABEL[s.source_type]}{s.is_official ? " · official" : " · secondary"}</span>
                    <span>Method: {s.retrieval_method}{s.config?.runner === "local" ? " · fetched by the Mac collector (blocked from Vercel)" : ""}</span>
                    <span>Credibility weight: {s.credibility.toFixed(2)}</span>
                    <span>Coverage: {s.geographic_coverage}</span>
                    <span>Sectors: {s.sector_relevance.join(", ")}</span>
                  </div>
                  <a href={s.feed_url ?? s.base_url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-accent break-all hover:underline">{s.feed_url ?? s.base_url}</a>
                  {s.access_limitations && <p className="mt-1 text-sm text-ink-2">{s.access_limitations}</p>}
                  <p className="mt-1 text-xs text-ink-3">
                    Last success: {s.last_success_at ? formatDateTime(s.last_success_at, tz) : "never"}{s.last_item_count != null ? ` (${s.last_item_count} items)` : ""}
                    {s.last_error && <span className="text-danger"> · Last error ({s.last_error_at ? formatDateTime(s.last_error_at, tz) : ""}): {s.last_error}</span>}
                  </p>
                  {r && <p className="text-xs text-ink-3">Last run: {r.candidates} relevant candidates, {r.new} new, {r.duplicates} duplicates{Object.keys(r.skipped).length ? ` · filtered: ${Object.entries(r.skipped).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}</p>}
                </div>
                {s.retrieval_method !== "link_only" && (
                  <div className="flex items-center gap-2 text-xs text-ink-3">
                    <SourceToggle id={s.id} enabled={s.enabled} />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
