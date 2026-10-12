import Link from "next/link";
import { ANNOUNCEMENT_TYPES, ANNOUNCEMENT_TYPE_LABEL } from "@/lib/ai/analysis";
import { hasAdvancedFilters, type Filters } from "@/lib/repo/filters";
import { REVIEW_LABEL, REVIEW_STATUSES } from "@/lib/repo/opportunities";
import type { Settings } from "@/lib/settings/schema";
import { SOURCE_TYPE_LABEL } from "@/lib/sources/types";

const field = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm";

function Select({ name, label, value, options, hideLabel }: { name: string; label: string; value: string; options: Array<[string, string]>; hideLabel?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-3">
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <select name={name} defaultValue={value} className={field}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

/** Plain GET form: filters live in the URL, so they survive reloads and are shareable. */
export function FilterBar({ f, settings }: { f: Filters; settings: Settings }) {
  const advancedOpen = hasAdvancedFilters(f, settings.reportingWindowDays);
  return (
    <form method="get" action="/" className="rounded-xl border border-line bg-surface p-3" role="search" aria-label="Filter opportunities">
      <input type="hidden" name="mode" value={f.mode} />
      <div className="grid gap-2 sm:grid-cols-[1fr_200px_200px_auto]">
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          <span className="sr-only">Search</span>
          <input name="q" defaultValue={f.q} placeholder="Search company, programme or place…" className={field} />
        </label>
        <Select hideLabel name="sector" label="Sector" value={f.sector} options={[["", "All sectors"], ...settings.sectors.map((s) => [s.key, s.label] as [string, string])]} />
        <Select hideLabel name="sort" label="Sort by" value={f.sort} options={[["score", "Sort: most relevant"], ["date", "Sort: newest first"], ["company", "Sort: company A–Z"]]} />
        <button type="submit" className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-surface">Apply</button>
      </div>

      <details className="group mt-2" open={advancedOpen}>
        <summary className="cursor-pointer select-none text-sm text-ink-2 hover:text-ink list-none">
          <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>›</span> More filters
          {advancedOpen && <span className="ml-2 text-xs text-accent">active</span>}
        </summary>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select name="days" label="Period" value={String(f.days)} options={[["3", "Last 3 days"], ["7", "Last 7 days"], ["14", "Last 14 days"], ["30", "Last 30 days"]]} />
          <Select name="freshness" label="Include" value={f.freshness} options={[["window", "This period (incl. undated)"], ["fresh", "Dated this period only"], ["all", "Everything, incl. older"]]} />
          <Select name="priority" label="Priority" value={f.priority} options={[["", "All except low relevance"], ["high", "Call this week"], ["monitor", "Watchlist"], ["policy", "Policy"], ["background", "Context only"], ["low", "Low relevance"]]} />
          <Select name="type" label="Announcement type" value={f.type} options={[["", "All types"], ...ANNOUNCEMENT_TYPES.map((t) => [t, ANNOUNCEMENT_TYPE_LABEL[t]] as [string, string])]} />
          <Select name="evidence" label="Evidence" value={f.evidence} options={[["", "Any"], ["strong", "Strong"], ["moderate", "Moderate"], ["weak", "Weak"]]} />
          <label className="flex flex-col gap-1 text-xs text-ink-3">
            Geography
            <input name="geography" defaultValue={f.geography} placeholder="e.g. Pune" className={field} />
          </label>
          <Select name="sourceType" label="Source type" value={f.sourceType} options={[["", "All sources"], ...Object.entries(SOURCE_TYPE_LABEL).filter(([k]) => k !== "synthetic")]} />
          <Select name="status" label="Your decision" value={f.status} options={[["", "Any"], ["unreviewed", "Not yet reviewed"], ...REVIEW_STATUSES.map((s) => [s, REVIEW_LABEL[s]] as [string, string])]} />
          {f.mode === "live" && (
            <Select name="verification" label="Verification" value={f.verification} options={[["", "All"], ["verified", "Verified only"], ["needs_verification", "Needs verification"]]} />
          )}
          <label className="flex items-end gap-2 pb-1.5 text-sm text-ink-2">
            <input type="checkbox" name="showLow" value="1" defaultChecked={f.showLow} /> Include low-relevance items
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Link href={`/?mode=${f.mode}`} className="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">Clear all</Link>
          <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface-2">Apply filters</button>
        </div>
      </details>
    </form>
  );
}
