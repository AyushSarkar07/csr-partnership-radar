"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Settings } from "@/lib/settings/schema";

const input = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm";
const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ListField({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <Field label={label} hint={hint ?? "Comma-separated"}>
      <input className={input} value={text} onChange={(e) => { setText(e.target.value); onChange(toList(e.target.value)); }} />
    </Field>
  );
}

export function SettingsForm({ initial, version, emailMissing }: { initial: Settings; version: number; emailMissing: string[] }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "error"; msg?: string; issues?: string[] }>({ kind: "idle" });
  const weightSum = useMemo(() => Object.values(s.weights).reduce((a, b) => a + b, 0), [s.weights]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setState({ kind: "busy" });
        const res = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return setState({ kind: "error", msg: json.error ?? "Save failed", issues: json.issues });
        setState({ kind: "ok", msg: `Saved (version ${json.version}). Scores are recalculated with the new settings everywhere.` });
        router.refresh();
      }}
    >
      <fieldset className="space-y-6">
        <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Focus sectors</h2>
          <p className="text-xs text-ink-3">Announcements are sorted into these sectors. Keywords decide which news is considered at all, and priority sets how much a sector counts (high 100%, medium 70%, low 45%).</p>
          {s.sectors.map((sec, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_2fr_auto] items-end">
              <Field label="Key"><input className={input} value={sec.key} onChange={(e) => set("sectors", s.sectors.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} /></Field>
              <Field label="Label"><input className={input} value={sec.label} onChange={(e) => set("sectors", s.sectors.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></Field>
              <Field label="Priority">
                <select className={input} value={sec.priority} onChange={(e) => set("sectors", s.sectors.map((x, j) => (j === i ? { ...x, priority: e.target.value as "high" | "medium" | "low" } : x)))}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </Field>
              <Field label="Keywords"><input className={input} defaultValue={sec.keywords.join(", ")} onChange={(e) => set("sectors", s.sectors.map((x, j) => (j === i ? { ...x, keywords: toList(e.target.value) } : x)))} /></Field>
              <button type="button" aria-label={`Remove ${sec.label}`} onClick={() => set("sectors", s.sectors.filter((_, j) => j !== i))} className="rounded-md border border-line px-2 py-1.5 text-sm hover:bg-surface-2">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => set("sectors", [...s.sectors, { key: "new_sector", label: "New sector", priority: "medium", keywords: [] }])} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface-2">+ Add sector</button>
          <ListField label="Excluded sectors" hint="Announcements only in these sectors get zero sector points (e.g. Environment, Sports)" value={s.excludedSectors} onChange={(v) => set("excludedSectors", v)} />
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 grid gap-4 sm:grid-cols-2">
          <h2 className="font-serif text-lg font-semibold sm:col-span-2">Geography & programmes</h2>
          <ListField label="Current operating geographies" hint="Cities or states. A programme in a listed city's state counts as state-wide coverage." value={s.operatingGeographies} onChange={(v) => set("operatingGeographies", v)} />
          <ListField label="Target expansion geographies" value={s.expansionGeographies} onChange={(v) => set("expansionGeographies", v)} />
          <ListField label="Excluded geographies" value={s.excludedGeographies} onChange={(v) => set("excludedGeographies", v)} />
          <ListField label="Programme types" value={s.programmeTypes} onChange={(v) => set("programmeTypes", v)} />
          <ListField label="Beneficiary groups" value={s.beneficiaryGroups} onChange={(v) => set("beneficiaryGroups", v)} />
          <Field label="Organisation name"><input className={input} value={s.organisation.name} onChange={(e) => set("organisation", { ...s.organisation, name: e.target.value })} /></Field>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
          <h2 className="font-serif text-lg font-semibold">Scoring</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            {(Object.keys(s.weights) as Array<keyof Settings["weights"]>).map((k) => (
              <Field key={k} label={{ sector: "Sector relevance", intent: "Current intent", recency: "Recency", geography: "Geographic fit", evidence: "Evidence quality" }[k]}>
                <input type="number" min={0} max={100} className={input} value={s.weights[k]} onChange={(e) => set("weights", { ...s.weights, [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
          <p className={`text-sm ${weightSum === 100 ? "text-high" : "text-danger"}`}>Weights total {weightSum}/100{weightSum !== 100 && " — must equal 100 to save"}</p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            <Field label="Full recency (hours)"><input type="number" className={input} value={s.recency.topHours} onChange={(e) => set("recency", { ...s.recency, topHours: Number(e.target.value) })} /></Field>
            <Field label="75% recency (hours)"><input type="number" className={input} value={s.recency.midHours} onChange={(e) => set("recency", { ...s.recency, midHours: Number(e.target.value) })} /></Field>
            <Field label="Score for undated items" hint="0–0.5"><input type="number" step="0.05" className={input} value={s.recency.unknownDateFraction} onChange={(e) => set("recency", { ...s.recency, unknownDateFraction: Number(e.target.value) })} /></Field>
            <Field label="High-priority threshold"><input type="number" className={input} value={s.thresholds.high} onChange={(e) => set("thresholds", { ...s.thresholds, high: Number(e.target.value) })} /></Field>
            <Field label="Monitor threshold"><input type="number" className={input} value={s.thresholds.monitor} onChange={(e) => set("thresholds", { ...s.thresholds, monitor: Number(e.target.value) })} /></Field>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 grid gap-4 sm:grid-cols-3">
          <h2 className="font-serif text-lg font-semibold sm:col-span-3">Reporting window & digest</h2>
          <Field label="Default reporting window (days)"><input type="number" min={1} max={60} className={input} value={s.reportingWindowDays} onChange={(e) => set("reportingWindowDays", Number(e.target.value))} /></Field>
          <Field label="Timezone" hint="IANA name"><input className={input} value={s.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
          <Field label="Delivery schedule" hint="Contact your administrator to change"><input className={input} value="Every Monday, 06:00 IST" readOnly /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.digest.enabled} onChange={(e) => set("digest", { ...s.digest, enabled: e.target.checked })} /> Run the weekly scheduled digest</label>
          <Field label="Max high-priority items"><input type="number" className={input} value={s.digest.maxHighPriority} onChange={(e) => set("digest", { ...s.digest, maxHighPriority: Number(e.target.value) })} /></Field>
          <Field label="Max monitor items"><input type="number" className={input} value={s.digest.maxMonitor} onChange={(e) => set("digest", { ...s.digest, maxMonitor: Number(e.target.value) })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.digest.emailEnabled} onChange={(e) => set("digest", { ...s.digest, emailEnabled: e.target.checked })} /> Email the live digest</label>
          <Field label="Recipient email"><input type="email" className={input} value={s.digest.emailTo} onChange={(e) => set("digest", { ...s.digest, emailTo: e.target.value })} /></Field>
          <p className="text-xs text-ink-3 sm:col-span-3">
            Email status: {emailMissing.some((m) => /[A-Z_]{6,}/.test(m)) ? <span className="text-monitor">email delivery has not been set up by your administrator. Digests are still available in the app.</span> : <span className="text-high">ready{s.digest.emailEnabled && s.digest.emailTo ? ` · sending to ${s.digest.emailTo}` : " · turn it on and add a recipient above"}</span>}
          </p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 grid gap-4 sm:grid-cols-2">
          <h2 className="font-serif text-lg font-semibold sm:col-span-2">Data mode</h2>
          <Field label="Default mode when opening the app">
            <select className={input} value={s.dataMode.defaultMode} onChange={(e) => set("dataMode", { ...s.dataMode, defaultMode: e.target.value as "live" | "demo" })}>
              <option value="live">Live data</option><option value="demo">Demo data</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.dataMode.showDemo} onChange={(e) => set("dataMode", { ...s.dataMode, showDemo: e.target.checked })} /> Show the demo data option</label>
        </section>
      </fieldset>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-paper py-3">
        <button type="submit" disabled={state.kind === "busy" || weightSum !== 100} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50">
          {state.kind === "busy" ? "Saving…" : "Save settings"}
        </button>
        <button type="button" onClick={() => setS(initial)} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50">Discard changes</button>
        <span className="text-xs text-ink-3">{version ? `Saved · version ${version}` : "Using default settings"}</span>
        {state.msg && <span role="status" className={state.kind === "error" ? "text-sm text-danger" : "text-sm text-high"}>{state.msg}</span>}
      </div>
      {state.issues && <ul className="list-disc pl-5 text-sm text-danger">{state.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
    </form>
  );
}
