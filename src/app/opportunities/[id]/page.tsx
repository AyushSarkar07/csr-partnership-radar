import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewControl } from "@/components/ReviewControl";
import { Card, Pill, PriorityPill, ScoreBadge, ScoreBar, SectionTitle, SyntheticBadge, VerificationBadge } from "@/components/ui";
import { ANNOUNCEMENT_TYPE_LABEL } from "@/lib/ai/analysis";
import { getDb } from "@/lib/db/client";
import { getOpportunityDetail } from "@/lib/queries";
import { REVIEW_LABEL } from "@/lib/repo/opportunities";
import { SOURCE_TYPE_LABEL, type SourceType } from "@/lib/sources/types";
import { formatDateTime } from "@/lib/time/window";

export const dynamic = "force-dynamic";

const PROVENANCE: Record<string, string> = {
  feed_pubdate: "from the publisher",
  api_seendate: "first indexed, approximate",
  synthetic: "demo date",
  unknown: "not provided by the source",
};

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  const d = await getOpportunityDetail(getDb(), id);
  if (!d?.opp) notFound();
  const { opp: o, settings, window, history } = d;
  const tz = settings.timezone;
  const labels = new Map(settings.sectors.map((s) => [s.key, s.label]));
  const a = o.analysis;
  const facts = o.claims.filter((c) => c.kind === "fact");
  const interp = o.claims.filter((c) => c.kind !== "fact");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-5">
      <Link href={`/?mode=${d.mode}`} className="text-sm text-accent hover:underline">← Back to {d.mode === "demo" ? "demo" : "live"} opportunities</Link>
      {o.dataOrigin === "synthetic" && (
        <div className="rounded-lg border border-synthetic/40 bg-synthetic-bg px-4 py-2.5 text-sm text-synthetic">
          <strong>Demo item.</strong> The company, announcement and source are fictional.
        </div>
      )}
      <div className="flex gap-4 items-start">
        <ScoreBadge score={o.score.total} priority={o.score.priority} />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <PriorityPill priority={o.score.priority} />
            <VerificationBadge status={o.verificationStatus} />
            {o.announcementType && <Pill className="bg-surface-2 text-ink-2">{ANNOUNCEMENT_TYPE_LABEL[o.announcementType]}</Pill>}
            <Pill className="bg-surface-2 text-ink-2">Confidence: {o.score.confidence}</Pill>
          </div>
          <h1 className="font-serif text-2xl font-semibold leading-tight">{o.headline}</h1>
          <p className="mt-1 text-ink-2">{o.company ?? "Company not identified"}{o.initiativeName ? ` · ${o.initiativeName}` : ""}</p>
          {o.deadline && (
            <p className="mt-1 text-sm">
              <strong>Application deadline: {o.deadline}</strong> <span className="text-ink-3">(as stated by the source listing{o.score.flags.includes("deadline_passed") ? " — passed" : ""})</span>
            </p>
          )}
          <p className="mt-2 text-lg"><strong>{o.score.verdict}.</strong> <span className="text-ink-2">{o.score.primaryReason}</span></p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="p-5 space-y-3">
            <SectionTitle>What was announced</SectionTitle>
            <p>{a?.summary ?? "Analysis pending. Read the original source below."}</p>
            {a && (
              <>
                <h3 className="text-sm font-semibold mt-3">Why it matters</h3>
                <p className="text-ink-2">{a.why_it_matters}</p>
                <h3 className="text-sm font-semibold mt-3">Evidence of partnership / funding intent</h3>
                <p className="text-ink-2">
                  <strong>{{ explicit: "Explicit invitation to NGOs.", implied: "Works with NGOs; no open call stated.", none: "No request for NGO partners stated." }[a.implementation_partner_signal.level]}</strong> {a.implementation_partner_signal.evidence}
                  {a.funding_signal.present && <><br />Funding signal: {a.funding_signal.description}</>}
                </p>
                {a.policy_implication && (
                  <p className="rounded-md bg-policy-bg text-policy px-3 py-2 text-sm">
                    Policy implication ({a.policy_implication.status === "confirmed" ? "confirmed in source" : "needs interpretation"}): {a.policy_implication.implication}
                  </p>
                )}
                <h3 className="text-sm font-semibold mt-3">Recommended next action</h3>
                <p>{o.nextAction}</p>
                {a.outreach_angle && <p className="text-sm text-ink-2"><span className="text-ink-3">Suggested outreach angle:</span> {a.outreach_angle}</p>}
                {a.injection_detected && <p className="text-sm text-danger">This source contained unusual embedded text and was treated with caution.</p>}
              </>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Evidence</SectionTitle>
            {facts.length === 0 && <p className="text-sm text-ink-3">No factual claims extracted.</p>}
            <ul className="space-y-3">
              {facts.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex gap-2 items-start">
                    {c.excerpt_verified ? <Pill className="bg-high-bg text-high">Confirmed in source</Pill> : <Pill className="bg-danger-bg text-danger">Not confirmed in source</Pill>}
                    <span className="font-medium">{c.claim}</span>
                  </div>
                  {c.excerpt && <blockquote className="mt-1 border-l-2 border-line pl-3 text-ink-2 italic">“{c.excerpt}”</blockquote>}
                </li>
              ))}
            </ul>
            {interp.length > 0 && (
              <>
                <h3 className="text-sm font-semibold mt-4 mb-1">Interpretations & unknowns</h3>
                <ul className="list-disc pl-5 text-sm text-ink-2 space-y-1">
                  {interp.map((c) => <li key={c.id}><span className="text-ink-3">[{c.kind}]</span> {c.claim}</li>)}
                </ul>
              </>
            )}
            <h3 className="text-sm font-semibold mt-4 mb-1">Missing information / uncertainties</h3>
            {o.missingInformation.length ? (
              <ul className="list-disc pl-5 text-sm text-ink-2 space-y-1">{o.missingInformation.map((m) => <li key={m}>{m}</li>)}</ul>
            ) : <p className="text-sm text-ink-3">None flagged.</p>}
          </Card>

          <Card className="p-5">
            <SectionTitle aside={<span className="text-xs text-ink-3">{o.coverage.length} source{o.coverage.length === 1 ? "" : "s"}</span>}>Sources & coverage</SectionTitle>
            <ul className="divide-y divide-line">
              {o.coverage.map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.is_primary && <Pill className="bg-ink text-surface">Primary</Pill>}
                    {o.dataOrigin === "synthetic" && <SyntheticBadge />}
                    <Pill className="bg-surface-2 text-ink-2">{SOURCE_TYPE_LABEL[c.source_type as SourceType] ?? c.source_type}{c.is_official ? " · official" : ""}</Pill>
                    <span className="text-ink-2">{c.publisher}</span>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block text-accent hover:underline break-words">{c.headline}</a>
                  <div className="mt-1 text-xs text-ink-3">
                    Published: {c.published_at ? formatDateTime(c.published_at, tz) : "Unknown"} ({PROVENANCE[c.published_at_provenance] ?? c.published_at_provenance}) · Retrieved: {formatDateTime(c.retrieved_at, tz)}
                  </div>
                  {c.excerpt && <p className="mt-1 text-xs text-ink-2 line-clamp-3">{c.excerpt}</p>}
                </li>
              ))}
            </ul>
            {d.related.length > 0 && (
              <>
                <h3 className="text-sm font-semibold mt-3 mb-1">Other announcements from this company</h3>
                <ul className="text-sm space-y-1">{d.related.map((r) => <li key={r.id}><Link className="text-accent hover:underline" href={`/opportunities/${r.id}`}>{r.headline}</Link></li>)}</ul>
              </>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <SectionTitle>Your decision</SectionTitle>
            {o.review && <p className="mb-3 text-sm">Current: <strong>{REVIEW_LABEL[o.review.status]}</strong> <span className="text-ink-3">· {formatDateTime(o.review.created_at, tz)}</span></p>}
            <ReviewControl id={o.id} current={o.review?.status ?? null} />
            {history.length > 0 && (
              <>
                <h3 className="text-sm font-semibold mt-4 mb-1">Status history</h3>
                <ol className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="border-l-2 border-line pl-3">
                      <div>{REVIEW_LABEL[h.status]} <span className="text-xs text-ink-3">· {formatDateTime(h.created_at, tz)} · {h.actor}</span></div>
                      {h.note && <div className="text-ink-2">{h.note}</div>}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle aside={<span className="text-sm font-semibold tabular-nums">{o.score.total}/100</span>}>Score breakdown</SectionTitle>
            <ul className="space-y-3">
              {o.score.components.map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="flex justify-between"><span>{c.label}</span><span className="tabular-nums">{c.points.toFixed(1)} / {c.max}</span></div>
                  <ScoreBar points={c.points} max={c.max} />
                  <div className="text-xs text-ink-3 mt-0.5">{c.explanation}</div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">Weights can be adjusted in Settings. Week: {formatDateTime(window.start, tz)} → {formatDateTime(window.end, tz)}.</p>
            <h3 className="text-sm font-semibold mt-3">Confidence: {o.score.confidence}</h3>
            <ul className="list-disc pl-5 text-xs text-ink-2">{o.score.confidenceReasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </Card>

          <Card className="p-5 text-sm space-y-1">
            <SectionTitle>Key details</SectionTitle>
            <div><span className="text-ink-3">Company:</span> {o.company ?? "—"}</div>
            <div><span className="text-ink-3">Initiative:</span> {o.initiativeName ?? "—"}</div>
            <div><span className="text-ink-3">Sectors:</span> {o.sectors.map((s) => labels.get(s) ?? s).join(", ") || "—"}{a?.other_sectors?.length ? ` (other: ${a.other_sectors.join(", ")})` : ""}</div>
            <div><span className="text-ink-3">Geographies:</span> {o.geographies.join(", ") || "—"} <span className="text-ink-3">· {o.geoFitLabel}</span></div>
            <div><span className="text-ink-3">Beneficiaries:</span> {a?.beneficiary_groups?.join(", ") || "—"}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
