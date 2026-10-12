import Link from "next/link";
import { ActionButtons } from "@/components/ActionButtons";
import { FilterBar } from "@/components/FilterBar";
import { ModeBanner, ModeSwitch } from "@/components/ModeSwitch";
import { OpportunityCard } from "@/components/OpportunityCard";
import { SourceHealthPanel } from "@/components/SourceHealth";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { getDb, isDbConfigured } from "@/lib/db/client";
import { getDashboard, parseSummary, referenceTime } from "@/lib/queries";
import { explainHidden, filtersToQuery, parseFilters } from "@/lib/repo/filters";
import { loadSettings } from "@/lib/settings/store";
import { formatDate, formatDateTime, nextDigestAt } from "@/lib/time/window";

export const dynamic = "force-dynamic";

function Tile({ label, value, hint, tone = "default", example }: { label: string; value: number; hint: string; tone?: "default" | "high" | "urgent"; example?: string }) {
  const ring = tone === "urgent" && value > 0 ? "border-danger/60" : tone === "high" && value > 0 ? "border-high/60" : "border-line";
  const num = tone === "urgent" && value > 0 ? "text-danger" : tone === "high" && value > 0 ? "text-high" : "";
  return (
    <div className={`rounded-xl border bg-surface p-4 ${ring}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${num}`}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{hint}</div>
      {example && value === 0 && (
        <Link href={example} className="mt-2 inline-block text-xs text-accent hover:underline">See a tested example →</Link>
      )}
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
  const hidden = explainHidden(d.all, filters);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">
            {formatDate(d.window.start, tz).replace(/, \d{4}$/, "")} – {formatDate(d.window.end, tz)}
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Is this worth a call this week?</h1>
        </div>
        <ModeSwitch mode={filters.mode} showDemo={settings.dataMode.showDemo} />
      </div>
      <ModeBanner mode={filters.mode} refLabel={formatDateTime(ref, tz)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-sm text-ink-2">
          {filters.mode === "live" ? (
            <>
              <span className={d.run && d.run.status === "failed" ? "text-danger" : "text-high"} aria-hidden>●</span>{" "}
              {d.okRun?.finished_at ? <>Updated {formatDateTime(d.okRun.finished_at, tz)}</> : "Not updated yet"}
              <span className="text-ink-3"> · {d.metrics.sourcesOk} of {d.metrics.sourcesEnabled} sources checked · </span>
            </>
          ) : (
            <span className="text-ink-3">Demo data as of {formatDateTime(ref, tz)} · </span>
          )}
          <span className="text-ink-3">Next digest {formatDate(nextDigestAt(new Date()), tz).replace(/, \d{4}$/, "")}, 06:00 IST</span>
        </p>
        <ActionButtons mode={filters.mode} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile tone="high" example={filters.mode === "live" ? "/?mode=demo&priority=high" : undefined} label="Worth a call this week" value={d.metrics.highPriority} hint={d.metrics.highPriority ? "ranked first in the list below" : "none met the bar this week"} />
        <Tile tone="urgent" example={filters.mode === "live" ? "/?mode=demo&q=Larkspur" : undefined} label="Calls closing in 7 days" value={d.metrics.closingSoon} hint={d.metrics.closingSoon ? "proposal deadlines coming up" : "no open NGO calls closing this week"} />
        <Tile label="On the watchlist" value={d.metrics.watchlist} hint="relevant, not yet a call" />
        <Tile example={filters.mode === "live" ? "/?mode=demo&priority=policy" : undefined} label="Policy developments" value={d.metrics.policy} hint={d.metrics.policy ? "affecting CSR spending" : "no CSR rule changes this week"} />
      </div>

      {digestSummary && d.digest && (
            <Card className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-lg font-semibold">This week in brief</h2>
                <Link className="text-xs text-accent hover:underline" href={`/digest/${d.digest.id}`}>Read the full digest →</Link>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{digestSummary.overview}</p>
            </Card>
      )}

      {filters.mode === "live" && (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm text-ink-2">
            <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>›</span>
            <span className="font-medium text-ink">This week&apos;s scan</span>
            <span className="text-ink-3">
              {d.activity.itemsChecked.toLocaleString("en-IN")} news items checked → {d.activity.kept} CSR announcements kept → {d.metrics.highPriority} worth a call
            </span>
          </summary>
          <ol className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="How this week's announcements were processed">
            {[
              { n: d.activity.updates, label: "updates run", hint: "automatic and on request" },
              { n: d.activity.itemsChecked.toLocaleString("en-IN"), label: "news items checked", hint: `from ${d.activity.sourcesChecked || d.metrics.sourcesOk} sources` },
              { n: d.activity.kept, label: "CSR-related announcements kept", hint: "after filtering and duplicate removal" },
              { n: d.activity.analysed, label: "analysed and scored", hint: `${d.activity.csrRelevant} confirmed as CSR activity` },
              { n: d.activity.watchlist, label: "on the watchlist", hint: "relevant, worth tracking" },
              { n: d.metrics.highPriority, label: "worth a call", hint: d.metrics.highPriority ? "see the list below" : "none met the bar yet" },
            ].map((x) => (
              <li key={x.label} className="rounded-lg bg-surface-2 p-3">
                <div className="text-xl font-semibold tabular-nums">{x.n}</div>
                <div className="text-xs text-ink-2">{x.label}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">{x.hint}</div>
              </li>
            ))}
          </ol>
        </details>
      )}
      {filters.mode === "live" && d.metrics.aiPending > 0 && <p className="text-sm text-ink-3">{d.metrics.aiPending} new item(s) queued for analysis on the next update.</p>}

      <FilterBar f={filters} settings={settings} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <SectionTitle>Opportunities</SectionTitle>
          <p className="-mt-1 text-xs text-ink-3">
            Showing {hidden.shown} of {d.all.length}
            {hidden.lowHidden > 0 && <> · {hidden.lowHidden} low-relevance hidden (<Link className="underline" href={`/?${filtersToQuery({ ...filters, showLow: true })}`}>show</Link>)</>}
            {hidden.olderHidden > 0 && <> · {hidden.olderHidden} older hidden (<Link className="underline" href={`/?${filtersToQuery({ ...filters, showLow: true, freshness: "all" })}`}>show</Link>)</>}
          </p>
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
