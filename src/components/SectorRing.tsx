import Link from "next/link";
import { sectorColour } from "@/lib/colours";

/**
 * Ring (donut) chart: each slice is a focus sector's share of this period's
 * relevant announcements. An announcement can belong to more than one sector,
 * so shares are of sector mentions. Legend rows filter the list below.
 */
export function SectorRing({
  sectors,
  total,
  hrefFor,
  activeKey,
}: {
  sectors: Array<{ key: string; label: string; count: number; index: number }>;
  total: number;
  hrefFor: (key: string) => string;
  activeKey: string;
}) {
  const size = 180;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const sum = sectors.reduce((s, x) => s + x.count, 0);
  const gap = sum > 0 && sectors.filter((x) => x.count > 0).length > 1 ? 3 : 0; // small gap between slices
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img" aria-label="Share of announcements by sector">
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          {sum > 0 &&
            sectors.map((s) => {
              if (s.count === 0) return null;
              const len = (s.count / sum) * circumference;
              const dash = Math.max(0, len - gap);
              const el = (
                <circle
                  key={s.key}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke={sectorColour(s.index)}
                  strokeWidth={activeKey === s.key ? stroke + 6 : stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  className="ring-progress"
                  style={{ ["--ring-full" as string]: `${circumference}` }}
                >
                  <title>{`${s.label}: ${s.count} (${Math.round((s.count / sum) * 100)}%)`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-semibold tabular-nums">{total}</span>
          <span className="max-w-[90px] text-[11px] leading-tight text-ink-3">relevant announcements</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-1.5">
        {sectors.map((s) => {
          const pct = sum ? Math.round((s.count / sum) * 100) : 0;
          const active = activeKey === s.key;
          return (
            <li key={s.key}>
              <Link
                href={hrefFor(active ? "" : s.key)}
                aria-current={active ? "true" : undefined}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2 [&>span:first-child]:mt-1"
                style={active ? { background: `color-mix(in oklab, ${sectorColour(s.index)} 14%, var(--surface))` } : undefined}
              >
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: sectorColour(s.index) }} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block">{s.label}</span>
                  <span className="text-xs text-ink-3"><span className="font-semibold" style={{ color: sectorColour(s.index) }}>{pct}%</span> · {s.count}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
