import type { HTMLAttributes, ReactNode } from "react";
import type { Priority } from "@/lib/scoring/score";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export const PRIORITY_STYLE: Record<Priority, { label: string; cls: string; bar: string; meaning: string }> = {
  high: { label: "Call this week", cls: "bg-high-bg text-high", bar: "bg-high", meaning: "Recent, relevant and credible: worth contacting this week." },
  monitor: { label: "Watchlist", cls: "bg-monitor-bg text-monitor", bar: "bg-monitor", meaning: "Relevant, but something is missing (date, location fit, clear intent or strong evidence). Keep an eye on it." },
  policy: { label: "Policy", cls: "bg-policy-bg text-policy", bar: "bg-policy", meaning: "A rule or policy change that affects how companies spend CSR funds." },
  background: { label: "Context only", cls: "bg-bgc-bg text-bgc", bar: "bg-bgc", meaning: "Useful background, such as past spending or older news. Not a reason to call now." },
  low: { label: "Low relevance", cls: "bg-low-bg text-low", bar: "bg-low", meaning: "Outside your focus sectors, or not about CSR." },
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
  return <Pill className={s.cls} title={s.meaning}>{s.label}</Pill>;
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

/** Circular score ring that draws itself on load (static when reduced motion is on). */
export function ScoreBadge({ score, priority, size = 56 }: { score: number; priority: Priority; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const full = 2 * Math.PI * r;
  const colour = { high: "var(--high)", monitor: "var(--monitor)", policy: "var(--policy)", background: "var(--background-c)", low: "var(--low)" }[priority];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={full}
          strokeDashoffset={full * (1 - score / 100)}
          className="ring-progress"
          style={{ ["--ring-full" as string]: `${full}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold leading-none tabular-nums" style={{ color: colour }}>{score}</span>
        <span className="text-[9px] text-ink-3">/100</span>
      </div>
    </div>
  );
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & Omit<HTMLAttributes<HTMLElement>, "className" | "children"> & { [key: `data-${string}`]: string | undefined }) {
  return <section {...rest} className={cx("rounded-xl border border-line bg-surface", className)}>{children}</section>;
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
