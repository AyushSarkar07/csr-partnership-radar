import Link from "next/link";
import { ActionButtons } from "@/components/ActionButtons";
import { FilterBar } from "@/components/FilterBar";
import { ModeBanner, ModeSwitch } from "@/components/ModeSwitch";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CountUp } from "@/components/CountUp";
import { SectorRing } from "@/components/SectorRing";
import { sectorColour, tint } from "@/lib/colours";
import { Card, EmptyState, PRIORITY_STYLE } from "@/components/ui";
import type { Priority } from "@/lib/scoring/score";
import { getDb, isDbConfigured } from "@/lib/db/client";
import { getDashboard, parseSummary, referenceTime } from "@/lib/queries";
import { explainHidden, filtersToQuery, parseFilters } from "@/lib/repo/filters";
import { loadSettings } from "@/lib/settings/store";
import { formatDate, formatDateTime, nextDigestAt } from "@/lib/time/window";

export const dynamic = "force-dynamic";

function Tile({ label, value, hint, colour, href, action }: { label: string; value: number | string; hint: string; colour: string; href: string; action: string }) {
  return (
    <Link
      href={href}
      className="lift group block h-full rounded-xl border p-4 focus-visible:outline-2"
      style={{ background: tint(colour, 9), borderColor: `color-mix(in oklab, ${colour} 38%, var(--line))` }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: colour }}>
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colour }} />
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums" style={{ color: colour }}>{typeof value === "number" ? <CountUp value={value} /> : value}</div>
      <div className="mt-0.5 text-xs text-ink-2">{hint}</div>
      <div className="mt-2 text-xs font-medium opacity-80 transition-opacity group-hover:opacity-100" style={{ color: colour }}>
        {action} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}

function ColourLegend({ sectors }: { sectors: Array<{ key: string; label: string }> }) {
  const order: Priority[] = ["high", "monitor", "policy", "background", "low"];
  return (
    <details className="group text-xs" data-tour="legend">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
        <span className="text-ink-3">Card colour = sector:</span>
        {sectors.map((x, i) => (
          <span key={x.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: sectorColour(i) }} />
            {x.label}
          </span>
        ))}
        <span className="text-accent group-open:hidden">What do the labels mean?</span>
        <span className="hidden text-accent group-open:inline">Hide</span>
      </summary>
      <dl className="mt-2 grid gap-1.5 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2">
        {order.map((p) => (
          <div key={p} className="flex gap-2">
            <dt className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${PRIORITY_STYLE[p].cls}`}>{PRIORITY_STYLE[p].label}</dt>
            <dd className="text-ink-2">{PRIORITY_STYLE[p].meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
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
  const loaded = await loadSettings(db);
  const { settings } = loaded;
  const sp = await searchParams;
  const filters = parseFilters(sp, { mode: settings.dataMode.defaultMode, days: settings.reportingWindowDays });
  if (filters.mode === "demo" && !settings.dataMode.showDemo) filters.mode = "live";
  const d = await getDashboard(db, filters, loaded);
  const tz = settings.timezone;
  const ref = referenceTime(filters.mode);
  const labels = new Map(settings.sectors.map((s) => [s.key, s.label]));
    const digestSummary = parseSummary(d.digest?.summary ?? null);
  const hidden = explainHidden(d.all, filters, d.window.end);

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

      <div data-tour="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
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

      {(() => {
        const live = filters.mode === "live";
        type T = { key: string; label: string; value: number | string; hint: string; colour: string; href: string; action: string };
        // Each tile opens the list already filtered to what it counts (or the page it describes).
        const listHref = (extra: Record<string, string>) => `/?${new URLSearchParams({ mode: filters.mode, ...extra })}#opportunities`;
        const worth: T = d.metrics.highPriority || !live
          ? { key: "worth", colour: "var(--high)", label: "Worth a call this week", value: d.metrics.highPriority, hint: "ranked first in the list below", href: listHref({ priority: "high" }), action: "Show these" }
          : { key: "worth", colour: "var(--high)", label: "Worth a call this week", value: 0, hint: "none met the bar this week", href: "/?mode=demo&priority=high#opportunities", action: "See a tested example" };
        const closing: T = { key: "closing", colour: "var(--danger)", label: "Calls closing in 7 days", value: d.metrics.closingSoon, hint: "proposal deadlines coming up", href: listHref({ closing: "1" }), action: "Show these calls" };
        const policy: T = { key: "policy", colour: "var(--policy)", label: "Policy developments", value: d.metrics.policy, hint: "affecting CSR spending", href: listHref({ priority: "policy" }), action: "Show these" };
        const watch: T = { key: "watch", colour: "var(--monitor)", label: "On the watchlist", value: d.metrics.watchlist, hint: "relevant, not yet a call", href: listHref({ priority: "monitor" }), action: "Show the watchlist" };
        const fresh: T = { key: "fresh", colour: "var(--accent)", label: live ? "New announcements" : "Demo announcements", value: d.metrics.freshAnnouncements, hint: "published in the last 7 days", href: listHref({ freshness: "fresh" }), action: "Show this week's" };
        const sources: T = { key: "sources", colour: "var(--s2)", label: "Sources checked", value: `${d.metrics.sourcesOk}/${d.metrics.sourcesEnabled}`, hint: "on the latest update", href: "/sources", action: "View sources" };
        // Urgent signals take a tile only when there is something to act on; otherwise
        // the slot shows other real activity and the "none this week" note goes below.
        const tiles = [worth, ...[closing, policy].filter((t) => Number(t.value) > 0), watch, fresh, sources].slice(0, 4);
        const quiet = [
          d.metrics.closingSoon === 0 && { text: "No open NGO calls closing in the next 7 days", example: "/?mode=demo&q=Larkspur" },
          d.metrics.policy === 0 && { text: "No CSR rule changes this week", example: "/?mode=demo&priority=policy" },
        ].filter(Boolean) as Array<{ text: string; example: string }>;
        return (
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-3">
          <div className="space-y-2" data-tour="tiles">
            <div className="grid grid-cols-2 gap-3">
              {tiles.map((t, i) => (
                <div key={t.key} className="fade-up h-full" style={{ animationDelay: `${i * 70}ms` }}>
                  <Tile colour={t.colour} href={t.href} action={t.action} label={t.label} value={t.value} hint={t.hint} />
                </div>
              ))}
            </div>
            {quiet.length > 0 && (
              <p className="text-xs text-ink-3">
                {quiet.map((q, i) => (
                  <span key={q.text}>
                    {i > 0 && " · "}
                    {q.text}
                    {live && <> (<Link href={q.example} className="text-accent hover:underline">see a tested example</Link>)</>}
                  </span>
                ))}
              </p>
            )}
          </div>
          {digestSummary && d.digest && (
            <Card className="fade-up p-4" style={{ animationDelay: "280ms", background: tint("var(--accent)", 6), borderColor: "color-mix(in oklab, var(--accent) 30%, var(--line))" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-lg font-semibold">This week in brief</h2>
                <Link className="text-xs text-accent hover:underline" href={`/digest/${d.digest.id}`}>Read the full digest →</Link>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{digestSummary.overview}</p>
            </Card>
          )}
          </div>
          <Card className="fade-up p-4" style={{ animationDelay: "120ms" }} data-tour="sectors">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold">Where opportunities come from</h2>
              <span className="text-xs text-ink-3">by sector · click to filter</span>
            </div>
            <div className="mt-3">
              <SectorRing
                sectors={d.sectorCounts.map((x, i) => ({ ...x, index: i }))}
                total={d.metrics.freshAnnouncements}
                activeKey={filters.sector}
                hrefFor={(key) => `/?${filtersToQuery({ ...filters, sector: key })}`}
              />
            </div>
            <p className="mt-3 text-xs text-ink-3">
              {filters.mode === "live" ? `${d.metrics.verified} of ${d.metrics.totalStored} announcements verified against the original source` : `${d.metrics.totalStored} demo announcements`}
            </p>
          </Card>
          </div>
        );
      })()}

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


      <div data-tour="filters">
        <FilterBar f={filters} settings={settings} />
      </div>

      <section id="opportunities" className="scroll-mt-4 space-y-3" aria-labelledby="opps-title">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h2 id="opps-title" className="flex flex-wrap items-center gap-2 font-serif text-lg font-semibold">
              Opportunities
              {(() => {
                const label = filters.closing
                  ? "Calls closing in 7 days"
                  : filters.priority
                    ? { high: "Worth a call this week", monitor: "On the watchlist", policy: "Policy developments", background: "Context only", low: "Low relevance" }[filters.priority as Priority]
                    : filters.freshness === "fresh"
                      ? "Published this week"
                      : null;
                return label ? (
                  <Link
                    href={`/?mode=${filters.mode}#opportunities`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-bg px-2.5 py-0.5 font-sans text-xs font-medium text-accent hover:border-accent"
                    aria-label={`Showing ${label}. Clear this filter`}
                  >
                    Showing: {label} <span aria-hidden>✕</span>
                  </Link>
                ) : null;
              })()}
            </h2>
            <p className="text-xs text-ink-3">
              Showing {hidden.shown} of {d.all.length}
              {hidden.lowHidden > 0 && <> · {hidden.lowHidden} low-relevance hidden (<Link className="underline" href={`/?${filtersToQuery({ ...filters, showLow: true })}`}>show</Link>)</>}
              {hidden.olderHidden > 0 && <> · {hidden.olderHidden} older hidden (<Link className="underline" href={`/?${filtersToQuery({ ...filters, showLow: true, freshness: "all" })}`}>show</Link>)</>}
            </p>
          </div>
          <ColourLegend sectors={settings.sectors.map((x) => ({ key: x.key, label: x.label }))} />
        </div>
        {d.shown.length === 0 ? (
          filters.mode === "live" && d.metrics.liveTotal === 0 ? (
            <EmptyState title="No live announcements collected yet">
              Use “Refresh intelligence” to check the sources now, or explore the demo data.{" "}
              <Link href="/?mode=demo" className="underline">Open the demo data</Link>.
            </EmptyState>
          ) : (
            <EmptyState title="Nothing matches these filters">
              Widen the period, include older or low-relevance items, or <Link href={`/?mode=${filters.mode}`} className="underline">clear the filters</Link>.
              {filters.mode === "live" && " Some weeks are quiet. The list only shows announcements that meet the criteria."}
            </EmptyState>
          )
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {d.shown.map((o, i) => (
              <div key={o.id} className="fade-up h-full" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }} data-tour={i === 0 ? "card" : undefined}>
                <OpportunityCard o={o} sectorLabels={labels} timezone={tz} refTime={ref} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
