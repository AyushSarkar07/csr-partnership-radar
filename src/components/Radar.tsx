import type { Priority } from "@/lib/scoring/score";

/**
 * The week's opportunities on a radar. Angle = focus sector, distance from the
 * centre = score (stronger is closer), colour = priority. A beam sweeps every
 * 6 s and each blip lights up as the beam passes over it. Pure SVG + CSS.
 */

export interface RadarPoint {
  id: string;
  label: string;
  score: number;
  priority: Priority;
  sector: string | null;
}

const SIZE = 400;
const C = SIZE / 2;
const R = 165;
const PERIOD = 6; // seconds per sweep (matches .radar-* animations)

const COLOUR: Record<Priority, string> = {
  high: "var(--high)",
  monitor: "var(--monitor)",
  policy: "var(--policy)",
  background: "var(--background-c)",
  low: "var(--low)",
};

/** Deterministic 0..1 from a string, so server and client agree and positions are stable. */
function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

// Scores cluster between 40 and 100, so that range is spread across the whole radius.
const radiusFor = (score: number) => R * (0.08 + 0.9 * Math.min(1, Math.max(0, (100 - score) / 60)));
const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};

export function Radar({ points, sectors, thresholds }: { points: RadarPoint[]; sectors: Array<{ key: string; label: string }>; thresholds: { high: number; monitor: number } }) {
  const n = Math.max(1, sectors.length);
  const wedge = 360 / n;
  const placed = points.slice(0, 48).map((p) => {
    const idx = p.sector ? sectors.findIndex((s) => s.key === p.sector) : -1;
    const angle = idx >= 0 ? idx * wedge + (0.12 + 0.76 * hash01(p.id, 1)) * wedge : 360 * hash01(p.id, 2);
    const r = radiusFor(p.score) + (hash01(p.id, 3) - 0.5) * 6;
    const delay = (angle / 360) * PERIOD - 0.86 * PERIOD; // ping peaks at 86% of the cycle
    return { ...p, angle, ...polar(angle, r), delay };
  });

  // Fading trail behind the beam: thin slices of decreasing opacity.
  const trail = Array.from({ length: 14 }, (_, i) => {
    const a0 = -i * 3.5 - 3.5;
    const a1 = -i * 3.5;
    const p0 = polar(a0, R);
    const p1 = polar(a1, R);
    return { d: `M ${C} ${C} L ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${p1.x} ${p1.y} Z`, o: 0.34 * (1 - i / 14) };
  });

  return (
    <figure className="relative mx-auto w-full max-w-[420px]">
      <svg viewBox={`-62 -8 ${SIZE + 124} ${SIZE + 16}`} className="w-full" role="img" aria-labelledby="radar-title radar-desc">
        <title id="radar-title">This week&apos;s opportunities on the radar</title>
        <desc id="radar-desc">
          {placed.length} opportunities. Closer to the centre means a stronger opportunity. Each slice is a focus sector.
        </desc>
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={C} cy={C} r={R + 6} fill="url(#radar-bg)" />
        {/* Score rings: inner = call this week, middle = watchlist, outer = the rest */}
        {[thresholds.high, thresholds.monitor, 40].map((t, i) => (
          <circle key={t} cx={C} cy={C} r={radiusFor(t)} fill="none" stroke="var(--line)" strokeWidth={i === 2 ? 1.5 : 1} strokeDasharray={i === 2 ? undefined : "3 5"} />
        ))}
        <text x={C + 4} y={C - radiusFor(thresholds.high) + 12} fontSize="9" fill="var(--high)" opacity="0.9">call</text>
        <text x={C + 4} y={C - radiusFor(thresholds.monitor) + 12} fontSize="9" fill="var(--monitor)" opacity="0.9">watch</text>

        {/* Sector boundaries and labels */}
        {sectors.map((s, i) => {
          const edge = polar(i * wedge, R);
          const mid = polar(i * wedge + wedge / 2, R + 14);
          const anchor = Math.abs(mid.x - C) < 8 ? "middle" : mid.x > C ? "start" : "end";
          return (
            <g key={s.key}>
              <line x1={C} y1={C} x2={edge.x} y2={edge.y} stroke="var(--line)" strokeWidth="1" />
              <text x={mid.x} y={mid.y + 4} fontSize="14" fontWeight="500" fill="var(--ink-2)" textAnchor={anchor}>{s.label}</text>
            </g>
          );
        })}

        {/* Rotating beam */}
        <g className="radar-sweep" style={{ transformOrigin: `${C}px ${C}px` }}>
          {trail.map((t, i) => <path key={i} d={t.d} fill="var(--accent)" opacity={t.o} />)}
          <line x1={C} y1={C} x2={C} y2={C - R} stroke="var(--accent)" strokeWidth="2" opacity="0.9" />
        </g>

        {/* Blips */}
        {placed.map((p) => (
          <a key={p.id} href={`/opportunities/${p.id}`} aria-label={`${p.label}, score ${p.score}`}>
            <title>{`${p.label} — ${p.score}/100`}</title>
            <circle cx={p.x} cy={p.y} r="9" fill={COLOUR[p.priority]} className="radar-ping" style={{ animationDelay: `${p.delay}s` }} />
            <circle cx={p.x} cy={p.y} r={p.priority === "high" ? 5.5 : 4.5} fill={COLOUR[p.priority]} stroke="var(--surface)" strokeWidth="1.5" className="radar-dot" style={{ animationDelay: `${p.delay}s` }} />
          </a>
        ))}

        <circle cx={C} cy={C} r="4" fill="var(--accent)" className="radar-centre" />
      </svg>
      <figcaption className="mt-1 text-center text-xs text-ink-3">
        {placed.length} on the radar · closer to the centre = stronger · hover or click a dot
      </figcaption>
    </figure>
  );
}
