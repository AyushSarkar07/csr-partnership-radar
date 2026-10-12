import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { getDb, isDbConfigured } from "@/lib/db/client";
import { getHealth, lastSuccessfulRun } from "@/lib/queries";
import { formatDateTime } from "@/lib/time/window";

export const dynamic = "force-dynamic";

function Row({ ok, label, detail, optional }: { ok: boolean; label: string; detail: string; optional?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Pill className={ok ? "bg-high-bg text-high" : optional ? "bg-surface-2 text-ink-3" : "bg-monitor-bg text-monitor"}>{ok ? "Operational" : optional ? "Off" : "Attention"}</Pill>
      <div><div className="font-medium">{label}</div><div className="text-sm text-ink-2">{detail}</div></div>
    </li>
  );
}

/** System overview for the partnerships team. Reports state only, never configuration values. */
export default async function StatusPage() {
  const db = isDbConfigured() ? getDb() : null;
  const h = (await getHealth(db)) as Partial<Awaited<ReturnType<typeof getHealth>>> & {
    records?: { live: number; synthetic: number; digests: number };
    email?: { configured: boolean; missing: string[] };
    database: { configured: boolean; connected?: boolean };
    gemini: { configured: boolean };
    cronSecret: boolean;
  };
  const okRun = db && h.ok ? await lastSuccessfulRun(db) : null;
  const tz = "Asia/Kolkata";
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4">
      <h1 className="font-serif text-3xl font-semibold">System status</h1>
      <Card className="p-5">
        <ul className="divide-y divide-line">
          <Row ok={Boolean(h.database.connected)} label="Data storage" detail={h.database.connected ? "Connected" : "Unavailable. Please contact your administrator."} />
          <Row ok={Boolean(h.records && h.records.live > 0)} label="Live coverage" detail={h.records ? `${h.records.live} announcements tracked${okRun?.finished_at ? ` · last updated ${formatDateTime(okRun.finished_at, tz)}` : ""}` : "No data yet"} />
          <Row ok={h.gemini.configured} label="Announcement analysis" detail={h.gemini.configured ? "Running" : "Unavailable. New announcements are queued until it is restored."} />
          <Row ok={Boolean(h.cronSecret)} label="Weekly digest schedule" detail={h.cronSecret ? "Active · every Monday at 06:00 IST" : "Not active. Please contact your administrator."} />
          <Row ok={Boolean(h.email?.configured)} optional label="Email delivery" detail={h.email?.configured ? "Active · the weekly digest is emailed to the recipient in Settings" : "Off. Digests are available in the app and can be printed."} />
          <Row ok={Boolean(h.records && h.records.synthetic > 0)} optional label="Demo data" detail={h.records && h.records.synthetic > 0 ? "Available" : "Not loaded"} />
        </ul>
      </Card>
      <p className="text-sm text-ink-2"><Link className="underline" href="/">Open this week&apos;s opportunities</Link> or <Link className="underline" href="/digest">read the latest digest</Link>.</p>
    </div>
  );
}
