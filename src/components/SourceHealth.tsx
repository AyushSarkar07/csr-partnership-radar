import Link from "next/link";
import type { SourceRecord } from "@/lib/sources/types";
import { formatDateTime } from "@/lib/time/window";
import { Card, Pill, SectionTitle } from "./ui";

export function sourceState(s: SourceRecord): { label: string; cls: string } {
  if (s.retrieval_method === "link_only") return { label: "Link only", cls: "bg-surface-2 text-ink-3" };
  if (!s.enabled) return { label: "Disabled", cls: "bg-surface-2 text-ink-3" };
  if (s.last_error) return { label: "Failed", cls: "bg-danger-bg text-danger" };
  if (s.last_success_at) return { label: "OK", cls: "bg-high-bg text-high" };
  return { label: "Never checked", cls: "bg-monitor-bg text-monitor" };
}

export function SourceHealthPanel({ sources, timezone }: { sources: SourceRecord[]; timezone: string }) {
  const fetchable = sources.filter((s) => s.enabled && s.retrieval_method !== "link_only");
  return (
    <Card className="p-4">
      <SectionTitle aside={<Link href="/sources" className="text-xs text-accent hover:underline">Registry →</Link>}>Source health</SectionTitle>
      <ul className="divide-y divide-line text-sm">
        {fetchable.map((s) => {
          const st = sourceState(s);
          return (
            <li key={s.id} className="py-2 flex items-start gap-2">
              <Pill className={st.cls}>{st.label}</Pill>
              <div className="min-w-0">
                <div className="truncate">{s.name}{s.config?.runner === "local" && <span className="ml-1 text-xs text-ink-3">· via Mac collector</span>}</div>
                <div className="text-xs text-ink-3">
                  {s.last_error ? <span className="text-danger">{s.last_error.slice(0, 90)}</span> : s.last_success_at ? `Checked ${formatDateTime(s.last_success_at, timezone)} · ${s.last_item_count ?? 0} items` : "Not fetched yet"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-3">{sources.length - fetchable.length} more sources are disabled or link-only (robots.txt / access restrictions) — see registry.</p>
    </Card>
  );
}
