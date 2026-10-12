import { sourceState } from "@/components/SourceHealth";
import { SourceToggle } from "@/components/SourceToggle";
import { Card, Pill } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { friendlySourceError } from "@/lib/friendly";
import { latestRun } from "@/lib/queries";
import { loadSettings } from "@/lib/settings/store";
import { listSources } from "@/lib/sources/registry";
import { SOURCE_TYPE_LABEL, type SourceRecord } from "@/lib/sources/types";
import { formatDateTime } from "@/lib/time/window";

export const dynamic = "force-dynamic";

const FORMAT: Record<SourceRecord["retrieval_method"], string> = {
  rss: "News feed",
  gdelt_api: "News index",
  ngobox_html: "Listings page",
  link_only: "Website",
};

function reliability(c: number) {
  return c >= 0.9 ? "High" : c >= 0.7 ? "Good" : "Moderate";
}

export default async function SourcesPage() {
  const db = getDb();
  const [sources, { settings }, run] = await Promise.all([listSources(db), loadSettings(db), latestRun(db)]);
  const tz = settings.timezone;
  const perSource = new Map(((run?.details as { sources?: Array<{ sourceId: string; candidates: number; new: number }> } | null)?.sources ?? []).map((s) => [s.sourceId, s]));
  const automatic = sources.filter((s) => s.retrieval_method !== "link_only" && (s.enabled || !s.notes?.startsWith("Paused")));
  const manual = sources.filter((s) => !automatic.includes(s));
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Sources</h1>
        <p className="text-ink-2 text-sm max-w-3xl">
          The publications and listings the radar checks for CSR announcements, partner calls and policy changes. Turn a source off to stop checking it.
        </p>
        {run && <p className="mt-1 text-xs text-ink-3">Last update {formatDateTime(run.started_at, tz)} · {run.sources_succeeded} of {run.sources_attempted} sources checked successfully · {run.items_new} new announcement{run.items_new === 1 ? "" : "s"}</p>}
      </div>
      <div className="grid gap-3">
        {automatic.map((s) => {
          const st = sourceState(s);
          const r = perSource.get(s.id);
          return (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Pill className={st.cls}>{st.label}</Pill>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  {s.notes && <p className="text-sm text-ink-2">{s.notes}</p>}
                  <div className="mt-1 text-xs text-ink-3 flex flex-wrap gap-x-3">
                    <span>{SOURCE_TYPE_LABEL[s.source_type]}{s.is_official ? " · official" : ""}</span>
                    <span>{FORMAT[s.retrieval_method]}</span>
                    <span>Reliability: {reliability(s.credibility)}</span>
                    <span>{s.geographic_coverage}</span>
                  </div>
                  <a href={s.base_url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-accent break-all hover:underline">{s.base_url.replace(/^https?:\/\//, "")}</a>
                  <p className="mt-1 text-xs text-ink-3">
                    Last checked: {s.last_success_at ? formatDateTime(s.last_success_at, tz) : "not yet"}
                    {r && ` · ${r.new} new, ${r.candidates} relevant`}
                    {s.last_error && <span className="text-danger"> · {friendlySourceError(s.last_error)}</span>}
                  </p>
                </div>
                <SourceToggle id={s.id} enabled={s.enabled} />
              </div>
            </Card>
          );
        })}
      </div>
      {manual.length > 0 && (
        <>
          <h2 className="font-serif text-xl font-semibold pt-2">Checked manually</h2>
          <p className="text-sm text-ink-2">These sites don&apos;t allow automated checks. Visit them directly when needed.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {manual.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="font-medium">{s.name}</div>
                {s.notes && <p className="text-sm text-ink-2">{s.notes}</p>}
                <a href={s.base_url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-accent break-all hover:underline">{s.base_url.replace(/^https?:\/\//, "")}</a>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
