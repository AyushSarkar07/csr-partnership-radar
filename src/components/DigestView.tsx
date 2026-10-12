import Link from "next/link";
import type { DigestItemPayload } from "@/lib/digest/build";
import { parseSummary, type DigestRow } from "@/lib/queries";
import { REVIEW_LABEL, type ReviewStatus } from "@/lib/repo/opportunities";
import { formatDate, formatDateTime } from "@/lib/time/window";
import { PrintButton } from "./PrintButton";
import { Card, Pill, SyntheticBadge } from "./ui";

const DELIVERY: Record<string, string> = {
  not_configured: "Not emailed — email delivery is not configured. This digest is stored here and can be printed or saved as PDF.",
  not_attempted: "Not emailed (demo digests are never emailed).",
  pending: "Email delivery in progress.",
  sent: "Email accepted by the provider.",
  failed: "Email delivery failed.",
};

function Item({ i, tz }: { i: DigestItemPayload; tz: string }) {
  return (
    <article className="border-t border-line py-4 first:border-t-0 break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tabular-nums rounded bg-surface-2 px-2 py-0.5">{i.score}/100</span>
        {i.dataOrigin === "synthetic" && <SyntheticBadge />}
        {i.announcementType && <Pill className="bg-surface-2 text-ink-2">{i.announcementType}</Pill>}
        {i.reviewStatus && <Pill className="border border-line text-ink-2">✓ {REVIEW_LABEL[i.reviewStatus as ReviewStatus] ?? i.reviewStatus}</Pill>}
        <span className="text-xs text-ink-3">Confidence {i.confidence} · evidence {i.evidenceStrength}</span>
      </div>
      <h3 className="mt-1 font-medium">
        <Link href={`/opportunities/${i.announcementId}`} className="hover:underline"><span className="font-semibold">{i.company ?? "Unknown company"}</span> — {i.headline}</Link>
      </h3>
      <p className="text-xs text-ink-3">
        {i.publishedAt ? formatDate(i.publishedAt, tz) : "Publication date unknown"} · {i.sectors.join(", ") || "No focus sector"} · {i.geographies.join(", ") || "Geography not stated"} ({i.geoFit})
      </p>
      <dl className="mt-2 grid gap-1.5 text-sm">
        <div><dt className="inline font-semibold">Verdict: </dt><dd className="inline">{i.verdict}. {i.primaryReason}</dd></div>
        <div><dt className="inline font-semibold">What was announced: </dt><dd className="inline">{i.whatWasAnnounced}</dd></div>
        <div><dt className="inline font-semibold">Why it matters: </dt><dd className="inline text-ink-2">{i.whyItMatters}</dd></div>
        <div><dt className="inline font-semibold">Intent evidence: </dt><dd className="inline text-ink-2">{i.intentEvidence}{i.fundingSignal ? ` Funding: ${i.fundingSignal}` : ""}</dd></div>
        {i.policyImplication && <div><dt className="inline font-semibold">Implication ({i.policyImplication.status === "confirmed" ? "confirmed" : "needs interpretation"}): </dt><dd className="inline">{i.policyImplication.implication}</dd></div>}
        {i.uncertainties.length > 0 && <div><dt className="inline font-semibold">Uncertainties: </dt><dd className="inline text-ink-2">{i.uncertainties.join("; ")}</dd></div>}
        <div><dt className="inline font-semibold">Next action: </dt><dd className="inline">{i.nextAction}</dd></div>
        {i.outreachAngle && <div><dt className="inline font-semibold">Outreach angle: </dt><dd className="inline text-ink-2">{i.outreachAngle}</dd></div>}
        <div className="text-xs text-ink-3">
          Score: {i.scoreBreakdown.map((b) => `${b.label} ${b.points}/${b.max}`).join(" · ")}
        </div>
        <div className="text-xs">
          Sources:{" "}
          {i.sources.map((s, k) => (
            <a key={k} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline mr-3">{s.publisher ?? "source"}{s.isPrimary ? " (primary)" : ""}</a>
          ))}
          <Link href={`/opportunities/${i.announcementId}`} className="no-print text-accent hover:underline">Review &amp; follow up →</Link>
        </div>
      </dl>
    </article>
  );
}

function Section({ title, hint, items, tz, empty }: { title: string; hint: string; items: DigestItemPayload[]; tz: string; empty: string }) {
  return (
    <Card className="p-5">
      <h2 className="font-serif text-xl font-semibold">{title} <span className="text-sm font-normal text-ink-3">({items.length})</span></h2>
      <p className="text-xs text-ink-3 mb-1">{hint}</p>
      {items.length ? items.map((i) => <Item key={i.announcementId} i={i} tz={tz} />) : <p className="py-3 text-sm text-ink-3">{empty}</p>}
    </Card>
  );
}

export function DigestView({ d }: { d: DigestRow }) {
  const c = d.content;
  const tz = d.timezone;
  const summary = parseSummary(d.summary);
  const byId = new Map([...c.sections.high_priority, ...c.sections.policy, ...c.sections.monitor].map((i) => [i.announcementId, i]));
  return (
    <div className="space-y-5">
      {d.data_mode === "demo" && (
        <div className="rounded-lg border border-synthetic/40 bg-synthetic-bg px-4 py-2.5 text-sm text-synthetic">
          <strong>DEMO DIGEST — synthetic data.</strong> Every item below is fictional and exists only to demonstrate the digest format.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">{d.data_mode === "live" ? "Live" : "Demo"} digest · {formatDate(c.window.start, tz)} → {formatDate(c.window.end, tz)} ({tz})</p>
          <h1 className="font-serif text-3xl font-semibold">Weekly CSR intelligence digest</h1>
          <p className="text-xs text-ink-3">Generated {formatDateTime(d.generated_at, tz)} ({d.trigger}){d.generation_count > 1 ? ` · regenerated ${d.generation_count}× for this window (same digest, no duplicates)` : ""}</p>
        </div>
        <PrintButton />
      </div>

      <Card className="p-5">
        <h2 className="font-serif text-lg font-semibold">This week in brief</h2>
        <p className="mt-1">{summary?.overview ?? "Summary unavailable."}</p>
        {summary && summary.top_actions.length > 0 && (
          <ol className="mt-3 list-decimal pl-5 text-sm space-y-1">
            {summary.top_actions.map((t) => (
              <li key={t.item_id}><strong>{byId.get(t.item_id)?.company ?? byId.get(t.item_id)?.headline.replace(/^Synthetic scenario: /, "").slice(0, 70) ?? "Item"}:</strong> {t.action}</li>
            ))}
          </ol>
        )}
        {summary?.caveats && <p className="mt-2 text-xs text-ink-3">{summary.caveats}</p>}
        {c.limitedEvidenceNote && <p className="mt-2 text-sm text-monitor">{c.limitedEvidenceNote}</p>}
        <p className="mt-3 text-xs text-ink-3">
          Overview written by {d.summary_source === "gemini" ? `Gemini (${d.ai_model})` : "deterministic fallback"}{d.ai_error ? ` — Gemini error: ${d.ai_error}` : ""}. Delivery: <strong>{d.delivery_status.replace("_", " ")}</strong> — {DELIVERY[d.delivery_status]}{d.delivery_error && d.delivery_status === "failed" ? ` (${d.delivery_error})` : ""}
        </p>
      </Card>

      <Section title="High priority — worth a call this week" hint="Fresh, relevant, credible intent and non-weak evidence. Not padded to a target count." items={c.sections.high_priority} tz={tz} empty="No opportunity met the high-priority bar this week." />
      <Section title="Opportunities to monitor" hint="Relevant but missing something: date, geography fit, explicit intent or strong evidence." items={c.sections.monitor} tz={tz} empty="Nothing to monitor." />
      <Section title="Policy & regulatory developments" hint="Changes affecting how companies deploy CSR funds, labelled confirmed or needing interpretation." items={c.sections.policy} tz={tz} empty="No policy developments found in the window." />
      <Section title="Background developments" hint="Relevant but outside the window or historical only — context, not outreach triggers." items={c.sections.background} tz={tz} empty="No background items." />
      <Card className="p-5">
        <h2 className="font-serif text-xl font-semibold">Sources that failed or could not be checked</h2>
        {d.data_mode === "demo" ? <p className="text-sm text-ink-3">Not applicable to synthetic data.</p> : c.failedSources.length ? (
          <ul className="mt-2 text-sm space-y-1">{c.failedSources.map((f) => <li key={f.sourceId}><strong>{f.name}</strong>: <span className="text-danger">{f.error}</span>{f.at ? <span className="text-ink-3"> · {formatDateTime(f.at, tz)}</span> : null}</li>)}</ul>
        ) : <p className="text-sm text-ink-3">All enabled sources were checked successfully on the last attempt.</p>}
        <p className="mt-2 text-xs text-ink-3">Disabled and link-only sources (robots.txt or access restrictions) are listed on the <Link href="/sources" className="underline">Sources</Link> page.</p>
      </Card>
    </div>
  );
}
