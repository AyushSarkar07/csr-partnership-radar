import Link from "next/link";
import { ActionButtons } from "@/components/ActionButtons";
import { FilterBar } from "@/components/FilterBar";
import { ModeBanner, ModeSwitch } from "@/components/ModeSwitch";
import { OpportunityCard } from "@/components/OpportunityCard";
import { SourceHealthPanel } from "@/components/SourceHealth";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { getDb, isDbConfigured } from "@/lib/db/client";
import { getDashboard, parseSummary, referenceTime } from "@/lib/queries";
import { parseFilters } from "@/lib/repo/filters";
import { loadSettings } from "@/lib/settings/store";
import { formatDate, formatDateTime } from "@/lib/time/window";

export const dynamic = "force-dynamic";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-2">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-3">{hint}</div>}
    </div>
  );
}

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  if (!isDbConfigured()) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState title="The radar is not set up yet">Please contact your administrator.</EmptyState>
      </div>
    );
  }
  const db = getDb();
  const { settings } = await loadSettings(db);
  const sp = await searchParams;
  const filters = parseFilters(sp, { mode: settings.dataMode.defaultMode, days: settings.reportingWindowDays });
  if (filters.mode === "demo" && !settings.dataMode.showDemo) filters.mode = "live";
  const d = await getDashboard(db, filters);
  const tz = settings.timezone;
  const ref = referenceTime(filters.mode);
  const labels = new Map(settings.sectors.map((s) => [s.key, s.label]));
  const maxSector = Math.max(1, ...d.sectorCounts.map((s) => s.count));
  const digestSummary = parseSummary(d.digest?.summary ?? null);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">
            Window: {formatDate(d.window.start, tz)} → {formatDate(d.window.end, tz)} ({tz})
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Is this worth a call this week?</h1>
        </div>
        <ModeSwitch mode={filters.mode} showDemo={settings.dataMode.showDemo} />
      </div>
      <ModeBanner mode={filters.mode} refLabel={formatDateTime(ref, tz)} />

      {filters.mode === "live" && (
        <Card className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold">This week&apos;s scan</h2>
            <span className="text-xs text-ink-3">
              {d.okRun?.finished_at ? `Last updated ${formatDateTime(d.okRun.finished_at, tz)}` : "Not updated yet"}
            </span>
          </div>
          <ol className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="How this week's announcements were processed">
            {[
              { n: d.activity.updates, label: "updates run", hint: "automatic and on request" },
              { n: d.activity.itemsChecked.toLocaleString("en-IN"), label: "news items checked", hint: `from ${d.activity.sourcesChecked || d.metrics.sourcesOk} sources` },
              { n: d.activity.kept, label: "CSR-related announcements kept", hint: "after filtering and duplicate removal" },
              { n: d.activity.analysed, label: "analysed and scored", hint: `${d.activity.csrRelevant} confirmed as CSR activity` },
              { n: d.activity.watchlist, label: "on the watchlist", hint: "relevant, worth tracking" },
              { n: d.metrics.highPriority, label: "worth a call now", hint: d.metrics.highPriority ? "see the list below" : "none met the bar yet" },
            ].map((s, i, arr) => (
              <li key={s.label} className="relative rounded-lg bg-surface-2 p-3">
                <div className="text-2xl font-semibold tabular-nums">{s.n}</div>
                <div className="text-xs text-ink-2">{s.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">{s.hint}</div>
                {i < arr.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-ink-3 lg:block">›</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric label={filters.mode === "live" ? "New announcements this week" : "Demo announcements this week"} value={d.metrics.freshAnnouncements} hint={d.metrics.unknownDates ? `plus ${d.metrics.unknownDates} with no publication date` : "published in the last 7 days"} />
        <Metric label="Worth a call this week" value={d.metrics.highPriority} hint={d.metrics.highPriority ? "high priority" : "none met the bar this week"} />
        <Metric label="Open calls for NGO partners" value={d.metrics.explicitRequests} hint={d.metrics.explicitRequests ? "explicit invitations" : "none published this week"} />
        <Metric label="On the watchlist" value={d.metrics.watchlist} hint="relevant, but not yet a call" />
        <Metric label="Policy developments" value={d.metrics.policy} hint={d.metrics.policy ? "affecting CSR spending" : "no CSR rule changes this week"} />
        <Metric label="Sources checked successfully" value={`${d.metrics.sourcesOk}/${d.metrics.sourcesEnabled}`} hint={filters.mode === "demo" ? "applies to live data" : "on the latest check"} />
      </div>

      <Card className="p-4 flex flex-wrap items-start justify-between gap-4">
        <ActionButtons mode={filters.mode} />
        <div className="text-sm text-ink-2 max-w-md">
          {d.digest ? (
            <>
              Latest digest: <Link className="text-accent hover:underline" href={`/digest/${d.digest.id}`}>{formatDateTime(d.digest.generated_at, tz)}</Link> ·{" "}
              {d.digest.content.counts.high_priority} high priority · delivery: <strong>{d.digest.delivery_status.replace("_", " ")}</strong>
              {digestSummary && <p className="mt-1 text-ink-3 line-clamp-2">{digestSummary.overview}</p>}
            </>
          ) : (
            <>No digest yet. The weekly digest is prepared every Monday at 06:00 IST.</>
          )}
          {d.run && d.run.status !== "succeeded" && filters.mode === "live" && (
            <p className="mt-1 text-monitor">Some sources could not be checked on the last update; earlier results are still shown.</p>
          )}
          {filters.mode === "live" && d.metrics.aiPending > 0 && <p className="mt-1 text-ink-3">{d.metrics.aiPending} new item(s) queued for analysis on the next refresh.</p>}
        </div>
      </Card>

      <FilterBar f={filters} settings={settings} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <SectionTitle aside={<span className="text-xs text-ink-3">{d.shown.length} of {d.all.length} stored · ranked by {filters.sort}</span>}>Ranked opportunities</SectionTitle>
          {d.shown.length === 0 ? (
            filters.mode === "live" && d.metrics.liveTotal === 0 ? (
              <EmptyState title="No live announcements collected yet">
                Use “Refresh intelligence” to check the sources now, or explore the demo data.{" "}
                <Link href="/?mode=demo" className="underline">Open the demo data</Link>.
              </EmptyState>
            ) : (
              <EmptyState title="Nothing matches these filters">
                Widen the window, include background/low-priority items, or <Link href={`/?mode=${filters.mode}`} className="underline">reset filters</Link>.
                {filters.mode === "live" && " Some weeks are quiet. The list only shows announcements that meet the criteria."}
              </EmptyState>
            )
          ) : (
            d.shown.map((o) => <OpportunityCard key={o.id} o={o} sectorLabels={labels} timezone={tz} refTime={ref} />)
          )}
        </div>
        <aside className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Where opportunities come from</SectionTitle>
            <p className="text-xs text-ink-3 mb-2">Relevant announcements in the window, by focus sector</p>
            <ul className="space-y-2 text-sm">
              {d.sectorCounts.map((s) => (
                <li key={s.key}>
                  <div className="flex justify-between"><span>{s.label}</span><span className="tabular-nums text-ink-2">{s.count}</span></div>
                  <div className="h-1.5 rounded-full bg-surface-2"><div className="h-1.5 rounded-full bg-high" style={{ width: `${(s.count / maxSector) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">{filters.mode === "live" ? `${d.metrics.verified} of ${d.metrics.totalStored} announcements verified against the original source.` : `${d.metrics.totalStored} demo announcements.`}</p>
          </Card>
          {filters.mode === "live" ? <SourceHealthPanel sources={d.sources} timezone={tz} /> : (
            <Card className="p-4 text-sm text-ink-2">
              <SectionTitle>About the demo data</SectionTitle>
              The demo shows how the radar handles open calls for partners, duplicate news coverage, missing dates, weak evidence, older news, other regions, policy changes and recorded decisions. Open any item to explore it.</Card>
          )}
        </aside>
      </div>
    </div>
  );
}
