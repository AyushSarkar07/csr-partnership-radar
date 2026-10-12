import type { ReactNode } from "react";
import type { Priority } from "@/lib/scoring/score";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export const PRIORITY_STYLE: Record<Priority, { label: string; cls: string }> = {
  high: { label: "Call this week", cls: "bg-high-bg text-high" },
  monitor: { label: "Monitor", cls: "bg-monitor-bg text-monitor" },
  policy: { label: "Policy", cls: "bg-policy-bg text-policy" },
  background: { label: "Background", cls: "bg-bgc-bg text-bgc" },
  low: { label: "Low", cls: "bg-low-bg text-low" },
};

export function Pill({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return <Pill className={s.cls}>{s.label}</Pill>;
}

export function SyntheticBadge({ className }: { className?: string }) {
  return (
    <Pill className={cx("bg-synthetic-bg text-synthetic border border-synthetic/30 uppercase tracking-wide", className)} title="Demo record — fictional company and source">
      Demo
    </Pill>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  if (status === "synthetic") return <SyntheticBadge />;
  if (status === "verified")
    return <Pill className="bg-high-bg text-high" title="Publication date known and key details confirmed against the original source">Verified</Pill>;
  return <Pill className="bg-monitor-bg text-monitor" title="Check the original source before acting (date or details not yet confirmed)">Needs verification</Pill>;
}

export function ScoreBadge({ score, priority }: { score: number; priority: Priority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <div className={cx("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl", s.cls)} aria-label={`Score ${score} out of 100`}>
      <span className="text-xl font-semibold leading-none tabular-nums">{score}</span>
      <span className="text-[10px] opacity-80">/100</span>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-xl border border-line bg-surface", className)}>{children}</section>;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <h2 className="font-serif text-lg font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function ScoreBar({ points, max }: { points: number; max: number }) {
  const pct = max ? Math.round((points / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-2" role="presentation">
      <div className="h-1.5 rounded-full bg-ink-2" style={{ width: `${pct}%` }} />
    </div>
  );
}
