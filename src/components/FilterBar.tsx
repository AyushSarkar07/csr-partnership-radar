import Link from "next/link";
import { ANNOUNCEMENT_TYPES, ANNOUNCEMENT_TYPE_LABEL } from "@/lib/ai/analysis";
import type { Filters } from "@/lib/repo/filters";
import { REVIEW_LABEL, REVIEW_STATUSES } from "@/lib/repo/opportunities";
import type { Settings } from "@/lib/settings/schema";
import { SOURCE_TYPE_LABEL } from "@/lib/sources/types";

const field = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm";

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Array<[string, string]> }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-3">
      {label}
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
  return (
    <form method="get" action="/" className="rounded-xl border border-line bg-surface p-3">
      <input type="hidden" name="mode" value={f.mode} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Select name="days" label="Reporting window" value={String(f.days)} options={[["3", "Last 3 days"], ["7", "Last 7 days"], ["14", "Last 14 days"], ["30", "Last 30 days"]].map(([v, l]) => [v, v === String(settings.reportingWindowDays) ? `${l} (default)` : l]) as Array<[string, string]>} />
        <Select name="freshness" label="Freshness" value={f.freshness} options={[["window", "In window + date unknown"], ["fresh", "Verified in window only"], ["all", "All, incl. background"]]} />
        <Select name="sector" label="Sector" value={f.sector} options={[["", "All sectors"], ...settings.sectors.map((s) => [s.key, s.label] as [string, string])]} />
        <Select name="type" label="Announcement type" value={f.type} options={[["", "All types"], ...ANNOUNCEMENT_TYPES.map((t) => [t, ANNOUNCEMENT_TYPE_LABEL[t]] as [string, string])]} />
        <Select name="priority" label="Priority" value={f.priority} options={[["", "High, monitor, policy, background"], ["high", "Call this week"], ["monitor", "Monitor"], ["policy", "Policy"], ["background", "Background"], ["low", "Low"]]} />
        <Select name="evidence" label="Evidence strength" value={f.evidence} options={[["", "Any"], ["strong", "Strong"], ["moderate", "Moderate"], ["weak", "Weak"]]} />
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Company
          <input name="company" defaultValue={f.company} placeholder="Name contains…" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Geography
          <input name="geography" defaultValue={f.geography} placeholder="e.g. Pune" className={field} />
        </label>
        <Select name="sourceType" label="Source type" value={f.sourceType} options={[["", "All sources"], ...Object.entries(SOURCE_TYPE_LABEL).filter(([k]) => k !== "synthetic")]} />
        <Select name="status" label="Workflow status" value={f.status} options={[["", "Any"], ["unreviewed", "Not yet reviewed"], ...REVIEW_STATUSES.map((s) => [s, REVIEW_LABEL[s]] as [string, string])]} />
        {f.mode === "live" ? (
          <Select name="verification" label="Live data status" value={f.verification} options={[["", "Verified + needs verification"], ["verified", "Verified only"], ["needs_verification", "Needs verification"]]} />
        ) : (
          <div className="flex flex-col gap-1 text-xs text-ink-3">Data<span className="rounded-md border border-line px-2 py-1.5 text-sm text-synthetic">Synthetic only</span></div>
        )}
        <Select name="sort" label="Sort by" value={f.sort} options={[["score", "Score (high → low)"], ["date", "Publication date"], ["company", "Company A–Z"]]} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="showLow" value="1" defaultChecked={f.showLow} /> Include low-priority items
        </label>
        <div className="ml-auto flex gap-2">
          <Link href={`/?mode=${f.mode}`} className="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2">Reset</Link>
          <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-surface">Apply filters</button>
        </div>
      </div>
    </form>
  );
}
