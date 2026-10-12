/**
 * The single definition of the reporting window, used by ingestion, the
 * dashboard, filters and the digest generator.
 *
 * Window = (end − days × 24h, end], i.e. start exclusive, end inclusive.
 * `end` is the reference time: "now" for live data, the run time for the
 * Monday digest, or the fixed demo reference time for synthetic data.
 * Consecutive Monday-06:00-IST digests therefore cover back-to-back,
 * non-overlapping 168-hour intervals.
 */

export interface ReportingWindow {
  start: Date;
  end: Date;
  days: number;
  timezone: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function reportingWindow(end: Date, days: number, timezone: string): ReportingWindow {
  return { start: new Date(end.getTime() - days * DAY), end, days, timezone };
}

export type Freshness = "fresh" | "stale" | "unknown" | "future";

/** Classifies a publication date against the window. Unknown dates are never "fresh". */
export function freshness(publishedAt: Date | null, w: ReportingWindow): Freshness {
  if (!publishedAt || Number.isNaN(publishedAt.getTime())) return "unknown";
  const t = publishedAt.getTime();
  // Allow one hour of clock skew between publishers and our servers.
  if (t > w.end.getTime() + HOUR) return "future";
  if (t > w.start.getTime()) return "fresh";
  return "stale";
}

export function hoursBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / HOUR;
}

/** YYYY-MM-DD in the given timezone (used for idempotency keys). */
export function dateKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatDateTime(d: Date | string | null, timezone: string): string {
  if (!d) return "Unknown";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export function formatDate(d: Date | string | null, timezone: string): string {
  if (!d) return "Date unknown";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function relativeAge(d: Date | string | null, ref: Date): string {
  if (!d) return "date unknown";
  const date = typeof d === "string" ? new Date(d) : d;
  const h = hoursBetween(date, ref);
  if (h < 0) return "in the future";
  if (h < 1) return "under an hour ago";
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Parses RSS/Atom/HTTP dates. Returns null (never "now") when unparseable. */
export function parseFeedDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  // GDELT seendate: 20261011T054500Z
  const gd = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  const d = gd ? new Date(`${gd[1]}-${gd[2]}-${gd[3]}T${gd[4]}:${gd[5]}:${gd[6]}Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Reject absurd dates rather than trusting them.
  if (d.getUTCFullYear() < 2000) return null;
  return d;
}
