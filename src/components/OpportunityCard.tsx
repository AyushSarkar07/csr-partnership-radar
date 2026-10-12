import Link from "next/link";
import { ANNOUNCEMENT_TYPE_LABEL } from "@/lib/ai/analysis";
import { REVIEW_LABEL, type Opportunity } from "@/lib/repo/opportunities";
import { SOURCE_TYPE_LABEL, type SourceType } from "@/lib/sources/types";
import { formatDate, relativeAge } from "@/lib/time/window";
import { Pill, PriorityPill, ScoreBadge, VerificationBadge } from "./ui";

export function OpportunityCard({ o, sectorLabels, timezone, refTime }: { o: Opportunity; sectorLabels: Map<string, string>; timezone: string; refTime: Date }) {
  const primary = o.coverage.find((c) => c.is_primary) ?? o.coverage[0];
  const freshLabel =
    o.score.freshness === "open_call" ? `Open call · deadline ${o.deadline}${o.publishedAt ? "" : " · publication date not shown"}` :
    o.score.freshness === "unknown" ? "Date unknown" : o.score.freshness === "stale" ? `Outside window · ${formatDate(o.publishedAt, timezone)}` : `${formatDate(o.publishedAt, timezone)} · ${relativeAge(o.publishedAt, refTime)}`;
  return (
    <article className="rounded-xl border border-line bg-surface p-4 hover:border-ink-3 transition-colors">
      <div className="flex gap-4">
        <ScoreBadge score={o.score.total} priority={o.score.priority} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <PriorityPill priority={o.score.priority} />
            <VerificationBadge status={o.verificationStatus} />
            {o.partnerSignal === "explicit" && <Pill className="bg-high text-surface">Seeking NGO partners</Pill>}
            {o.announcementType && <Pill className="bg-surface-2 text-ink-2">{ANNOUNCEMENT_TYPE_LABEL[o.announcementType]}</Pill>}
            {o.review && <Pill className="border border-line text-ink-2">✓ {REVIEW_LABEL[o.review.status]}</Pill>}
            {o.deadline && <Pill className={o.score.flags.includes("deadline_passed") ? "bg-low-bg text-low" : "bg-monitor-bg text-monitor"}>Deadline {o.deadline}{o.score.flags.includes("deadline_passed") ? " (passed)" : ""}</Pill>}
            {o.aiStatus === "pending" && <Pill className="bg-surface-2 text-ink-3">Awaiting AI analysis</Pill>}
            {o.aiStatus === "failed" && <Pill className="bg-danger-bg text-danger">AI analysis failed</Pill>}
          </div>
          <h3 className="font-medium leading-snug">
            <Link href={`/opportunities/${o.id}`} className="hover:underline">
              {o.company ? <span className="font-semibold">{o.company}: </span> : null}
              {o.headline}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-medium text-ink">{o.score.verdict}.</span> {o.score.primaryReason}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
            <div><dt className="sr-only">Published</dt><dd className={o.score.freshness === "unknown" ? "text-monitor" : ""}>{freshLabel}</dd></div>
            {o.sectors.length > 0 && <div><dt className="sr-only">Sectors</dt><dd>{o.sectors.map((s) => sectorLabels.get(s) ?? s).join(" · ")}</dd></div>}
            <div><dt className="sr-only">Geography</dt><dd>{o.geographies.length ? o.geographies.slice(0, 3).join(", ") : "Geography not stated"}</dd></div>
            {primary && (
              <div>
                <dt className="sr-only">Source</dt>
                <dd>
                  {primary.publisher} ({SOURCE_TYPE_LABEL[primary.source_type as SourceType] ?? primary.source_type})
                  {o.coverage.length > 1 && ` +${o.coverage.length - 1} more`}
                </dd>
              </div>
            )}
            <div><dt className="sr-only">Evidence</dt><dd>Evidence: {o.score.evidenceStrength} · confidence {o.score.confidence}</dd></div>
          </dl>
          <p className="mt-2 text-sm"><span className="text-ink-3">Next:</span> {o.nextAction}</p>
        </div>
      </div>
    </article>
  );
}
