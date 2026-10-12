import Link from "next/link";
import { Card, Pill } from "@/components/ui";
import { getDb, isDbConfigured } from "@/lib/db/client";
import { getHealth, latestRun } from "@/lib/queries";
import { formatDateTime } from "@/lib/time/window";

export const dynamic = "force-dynamic";

function Row({ ok, label, detail, warn }: { ok: boolean; label: string; detail: string; warn?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Pill className={ok ? "bg-high-bg text-high" : warn ? "bg-monitor-bg text-monitor" : "bg-danger-bg text-danger"}>{ok ? "Ready" : warn ? "Optional" : "Action needed"}</Pill>
      <div><div className="font-medium">{label}</div><div className="text-sm text-ink-2">{detail}</div></div>
    </li>
  );
}

/** First-run / health screen. Reports configuration state only; never secret values. */
export default async function StatusPage() {
  const db = isDbConfigured() ? getDb() : null;
  const h = (await getHealth(db)) as Partial<Awaited<ReturnType<typeof getHealth>>> & {
    records?: { live: number; synthetic: number; digests: number };
    email?: { configured: boolean; missing: string[] };
    database: { configured: boolean; connected?: boolean; migrations?: string[] };
    gemini: { configured: boolean; model: string };
    cronSecret: boolean;
  };
  const run = db && h.ok ? await latestRun(db) : null;
  const gem = h.gemini;
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-4">
      <h1 className="font-serif text-3xl font-semibold">System status</h1>
      <p className="text-sm text-ink-2">Setup checklist and live health. The same data is available as JSON at <a className="underline" href="/api/health">/api/health</a>.</p>
      <Card className="p-5">
        <ul className="divide-y divide-line">
          <Row ok={Boolean(h.database.connected)} label="Database (Postgres)" detail={h.database.connected ? `Connected · migrations: ${h.database.migrations?.join(", ")}` : "Set DATABASE_URL and run npm run db:migrate"} />
          <Row ok={Boolean(h.records && h.records.synthetic > 0)} label="Synthetic demo dataset" detail={h.records ? `${h.records.synthetic} synthetic records loaded` : "Run npm run db:seed"} />
          <Row ok={Boolean(h.records && h.records.live > 0)} label="Live data" detail={h.records ? `${h.records.live} live announcements stored${run ? ` · last run ${run.status} at ${formatDateTime(run.started_at, "Asia/Kolkata")}` : ""}` : "Run a refresh"} />
          <Row ok={gem.configured} label="Gemini Flash" detail={gem.configured ? `GEMINI_API_KEY set · model ${gem.model}` : `GEMINI_API_KEY missing — live items stay "awaiting AI analysis" (model ${gem.model})`} />
          <Row ok={Boolean(h.cronSecret)} label="Scheduled job (Vercel Cron)" detail={h.cronSecret ? "CRON_SECRET set · Mondays 06:00 IST" : "Set CRON_SECRET so the Monday job is authorised"} />
          <Row ok={Boolean(h.email?.configured)} warn label="Email delivery (optional)" detail={h.email?.configured ? "Resend configured" : `Not configured (${h.email?.missing.join(", ") ?? "n/a"}). Digests are stored in-app and printable.`} />
        </ul>
      </Card>
      <p className="text-sm text-ink-2">Next: <Link className="underline" href="/?mode=demo">explore the synthetic demo</Link>, or <Link className="underline" href="/">open live opportunities</Link>.</p>
    </div>
  );
}
