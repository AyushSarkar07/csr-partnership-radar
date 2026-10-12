import type { SourceRecord } from "@/lib/sources/types";

export function sourceState(s: SourceRecord): { label: string; cls: string } {
  if (s.retrieval_method === "link_only") return { label: "Manual check", cls: "bg-surface-2 text-ink-3" };
  if (!s.enabled) return { label: "Paused", cls: "bg-surface-2 text-ink-3" };
  if (s.last_error) return { label: "Issue", cls: "bg-danger-bg text-danger" };
  if (s.last_success_at) return { label: "OK", cls: "bg-high-bg text-high" };
  return { label: "Not checked yet", cls: "bg-monitor-bg text-monitor" };
}
