import Link from "next/link";
import { friendlySourceError } from "@/lib/friendly";
import type { SourceRecord } from "@/lib/sources/types";
import { formatDateTime } from "@/lib/time/window";
import { Card, Pill, SectionTitle } from "./ui";

export function sourceState(s: SourceRecord): { label: string; cls: string } {
  if (s.retrieval_method === "link_only") return { label: "Manual check", cls: "bg-surface-2 text-ink-3" };
  if (!s.enabled) return { label: "Paused", cls: "bg-surface-2 text-ink-3" };
  if (s.last_error) return { label: "Issue", cls: "bg-danger-bg text-danger" };
  if (s.last_success_at) return { label: "OK", cls: "bg-high-bg text-high" };
  return { label: "Not checked yet", cls: "bg-monitor-bg text-monitor" };
}

export function SourceHealthPanel({ sources, timezone }: { sources: SourceRecord[]; timezone: string }) {
  const fetchable = sources.filter((s) => s.enabled && s.retrieval_method !== "link_only");
  return (
    <Card className="p-4">
      <SectionTitle aside={<Link href="/sources" className="text-xs text-accent hover:underline">All sources →</Link>}>Source health</SectionTitle>
      <ul className="divide-y divide-line text-sm">
        {fetchable.map((s) => {
          const st = sourceState(s);
          return (
            <li key={s.id} className="py-2 flex items-start gap-2">
              <Pill className={st.cls}>{st.label}</Pill>
              <div className="min-w-0">
                <div className="break-words">{s.name}</div>
                <div className="text-xs text-ink-3">
                  {s.last_error ? <span className="text-danger">{friendlySourceError(s.last_error)}</span> : s.last_success_at ? `Checked ${formatDateTime(s.last_success_at, timezone)} · ${s.last_item_count ?? 0} items` : "Not fetched yet"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-3">{sources.length - fetchable.length} more sources are paused or checked manually.</p>
    </Card>
  );
}
