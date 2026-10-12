import Link from "next/link";
import { ANNOUNCEMENT_TYPE_LABEL } from "@/lib/ai/analysis";
import { REVIEW_LABEL, type Opportunity } from "@/lib/repo/opportunities";
import { formatDate, relativeAge } from "@/lib/time/window";
import { primarySectorIndex, sectorColour, tint } from "@/lib/colours";
import { Pill, PriorityPill, ScoreBadge, SyntheticBadge } from "./ui";

export function OpportunityCard({ o, sectorLabels, timezone, refTime }: { o: Opportunity; sectorLabels: Map<string, string>; timezone: string; refTime: Date }) {
  const primary = o.coverage.find((c) => c.is_primary) ?? o.coverage[0];
  const keys = [...sectorLabels.keys()];
  const sIdx = primarySectorIndex(o.sectors, keys);
  // Card colour = its main focus sector; policy items without a sector use the policy colour.
  const colour = sIdx >= 0 ? sectorColour(sIdx) : o.score.priority === "policy" ? "var(--policy)" : "var(--low)";
  const sectorName = sIdx >= 0 ? sectorLabels.get(keys[sIdx]) : o.score.priority === "policy" ? "Policy" : "Other";
  const deadlinePassed = o.score.flags.includes("deadline_passed");
  const when =
    o.score.freshness === "unknown" || (o.score.freshness === "open_call" && !o.publishedAt)
      ? "Publication date not shown"
      : o.score.freshness === "stale"
        ? `Published ${formatDate(o.publishedAt, timezone)}`
        : `${formatDate(o.publishedAt, timezone)} · ${relativeAge(o.publishedAt, refTime)}`;
  const meta = [
    o.announcementType ? ANNOUNCEMENT_TYPE_LABEL[o.announcementType] : null,
    when,
    o.sectors.length > 1 ? `Also: ${o.sectors.filter((k) => k !== keys[sIdx]).map((k) => sectorLabels.get(k) ?? k).join(", ")}` : null,
    o.geographies.length ? o.geographies.slice(0, 3).join(", ") : "Location not stated",
    primary ? `${primary.publisher}${o.coverage.length > 1 ? ` +${o.coverage.length - 1}` : ""}` : null,
  ].filter(Boolean);

  return (
    <article
      className="lift relative h-full overflow-hidden rounded-xl border p-4 pl-5"
      style={{ background: tint(colour, 6), borderColor: `color-mix(in oklab, ${colour} 32%, var(--line))` }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: colour }} />
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Pill className="font-semibold" style={{ background: tint(colour, 18), color: colour }}>{sectorName}</Pill>
            <PriorityPill priority={o.score.priority} />
            {o.partnerSignal === "explicit" && !deadlinePassed && <Pill className="bg-high text-surface">Open call for NGOs</Pill>}
            {o.deadline && (
              <Pill className={deadlinePassed ? "bg-low-bg text-low" : "bg-danger-bg text-danger"}>
                {deadlinePassed ? "Deadline passed" : `Deadline ${formatDate(o.deadline, timezone).replace(/^\w+, /, "")}`}
              </Pill>
            )}
            {o.review && <Pill className="border border-line text-ink-2">✓ {REVIEW_LABEL[o.review.status]}</Pill>}
            {o.verificationStatus === "synthetic" && <SyntheticBadge />}
            {o.verificationStatus === "needs_verification" && <Pill className="bg-monitor-bg text-monitor">Needs verification</Pill>}
            {o.aiStatus === "pending" && <Pill className="bg-surface-2 text-ink-3">Analysis pending</Pill>}
            {o.aiStatus === "failed" && <Pill className="bg-surface-2 text-ink-3">Analysis unavailable</Pill>}
          </div>
          <h3 className="text-[15px] font-medium leading-snug">
            <Link href={`/opportunities/${o.id}`} className="hover:underline">
              {o.company ? <span className="font-semibold">{o.company}: </span> : null}
              {o.headline}
            </Link>
          </h3>
          <p className="mt-1.5 text-sm text-ink-2">
            <span className="font-medium text-ink">{o.score.verdict}.</span> {o.score.primaryReason}
          </p>
          <p className="mt-2 text-xs text-ink-3">{meta.join(" · ")}</p>
          <p className="mt-2 text-sm"><span className="text-ink-3">Next step:</span> {o.nextAction}</p>
        </div>
        <ScoreBadge score={o.score.total} priority={o.score.priority} />
      </div>
    </article>
  );
}
