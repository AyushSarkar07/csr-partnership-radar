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
import { getSession } from "@/lib/session";
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
        <EmptyState title="Database not configured">Set DATABASE_URL, run <code>npm run db:migrate</code> and <code>npm run db:seed</code>. See <Link className="underline" href="/status">Status</Link>.</EmptyState>
      </div>
    );
  }
  const db = getDb();
  const { settings } = await loadSettings(db);
  const sp = await searchParams;
  const filters = parseFilters(sp, { mode: settings.dataMode.defaultMode, days: settings.reportingWindowDays });
  if (filters.mode === "demo" && !settings.dataMode.showDemo) filters.mode = "live";
  const [d, session] = await Promise.all([getDashboard(db, filters), getSession()]);
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Metric label={filters.mode === "live" ? "New live announcements in window" : "Synthetic announcements in window"} value={d.metrics.freshAnnouncements} hint={`${d.metrics.unknownDates} with unknown date`} />
        <Metric label="High priority (call this week)" value={d.metrics.highPriority} />
        <Metric label="Explicit NGO-partner requests" value={d.metrics.explicitRequests} />
        <Metric label="Policy developments" value={d.metrics.policy} />
        <Metric label="Live sources checked OK" value={`${d.metrics.sourcesOk}/${d.metrics.sourcesEnabled}`} hint={filters.mode === "demo" ? "live registry (not used by demo data)" : "last attempt per enabled source"} />
        <Metric
          label="Last successful live refresh"
          value={d.okRun?.finished_at ? formatDate(d.okRun.finished_at, tz).replace(/, \d{4}$/, "") : "Never"}
          hint={d.okRun?.finished_at ? formatDateTime(d.okRun.finished_at, tz) : "Run a refresh"}
        />
      </div>

      <Card className="p-4 flex flex-wrap items-start justify-between gap-4">
        <ActionButtons mode={filters.mode} signedIn={session.signedIn} />
        <div className="text-sm text-ink-2 max-w-md">
          {d.digest ? (
            <>
              Latest {filters.mode} digest: <Link className="text-accent hover:underline" href={`/digest/${d.digest.id}`}>{formatDateTime(d.digest.generated_at, tz)}</Link> ·{" "}
              {d.digest.content.counts.high_priority} high priority · delivery: <strong>{d.digest.delivery_status.replace("_", " ")}</strong>
              {digestSummary && <p className="mt-1 text-ink-3 line-clamp-2">{digestSummary.overview}</p>}
            </>
          ) : (
            <>No {filters.mode} digest yet. The scheduled job runs Mondays 06:00 IST.</>
          )}
          {d.run && d.run.status !== "succeeded" && filters.mode === "live" && (
            <p className="mt-1 text-monitor">Last run {d.run.status}{d.run.error ? `: ${d.run.error}` : ""} — previously collected data is preserved.</p>
          )}
          {filters.mode === "live" && d.metrics.aiPending > 0 && <p className="mt-1 text-ink-3">{d.metrics.aiPending} live item(s) awaiting Gemini analysis (processed on the next refresh).</p>}
        </div>
      </Card>

      <FilterBar f={filters} settings={settings} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <SectionTitle aside={<span className="text-xs text-ink-3">{d.shown.length} of {d.all.length} stored · ranked by {filters.sort}</span>}>Ranked opportunities</SectionTitle>
          {d.shown.length === 0 ? (
            filters.mode === "live" && d.metrics.liveTotal === 0 ? (
              <EmptyState title="No live announcements collected yet">
                {session.signedIn ? "Use “Refresh intelligence” to fetch the configured sources." : "Sign in and run “Refresh intelligence”, or explore the synthetic demo."}{" "}
                <Link href="/?mode=demo" className="underline">Open the synthetic demo</Link>.
              </EmptyState>
            ) : (
              <EmptyState title="Nothing matches these filters">
                Widen the window, include background/low-priority items, or <Link href={`/?mode=${filters.mode}`} className="underline">reset filters</Link>.
                {filters.mode === "live" && " A quiet week is a valid result: nothing is padded in."}
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
            <p className="mt-3 text-xs text-ink-3">{filters.mode === "live" ? `${d.metrics.verified} of ${d.metrics.totalStored} live records verified (date known + verbatim evidence).` : `${d.metrics.totalStored} synthetic records (after deduplication).`}</p>
          </Card>
          {filters.mode === "live" ? <SourceHealthPanel sources={d.sources} timezone={tz} /> : (
            <Card className="p-4 text-sm text-ink-2">
              <SectionTitle>About this demo</SectionTitle>
              30 fictional records exercise 16 scenarios: explicit partner calls, duplicates, missing dates, weak evidence, stale items, geographic mismatch, policy changes and review outcomes. Open any card to see its scenario and expected behaviour.
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
