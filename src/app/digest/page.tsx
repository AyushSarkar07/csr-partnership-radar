import Link from "next/link";
import { ActionButtons } from "@/components/ActionButtons";
import { DigestView } from "@/components/DigestView";
import { ModeSwitch } from "@/components/ModeSwitch";
import { Card, EmptyState } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { latestDigest, listDigests } from "@/lib/queries";
import { loadSettings } from "@/lib/settings/store";
import { formatDate, formatDateTime } from "@/lib/time/window";

const DELIVERY_LABEL: Record<string, string> = { sent: "emailed", failed: "email failed", not_configured: "not emailed", not_attempted: "", pending: "sending" };

export const dynamic = "force-dynamic";

export default async function DigestPage({ searchParams }: PageProps<"/digest">) {
  const sp = await searchParams;
  const db = getDb();
  const { settings } = await loadSettings(db);
  const mode = sp.mode === "demo" ? "demo" : sp.mode === "live" ? "live" : settings.dataMode.defaultMode;
  const [d, archive] = await Promise.all([latestDigest(db, mode), listDigests(db)]);
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <ModeSwitch mode={mode} basePath="/digest" showDemo={settings.dataMode.showDemo} />
        <ActionButtons mode={mode} />
      </div>
      {d ? <DigestView d={d} /> : (
        <EmptyState title={`No ${mode} digest generated yet`}>
          The scheduled job generates the live digest every Monday at 06:00 IST. You can also generate one now.
        </EmptyState>
      )}
      <Card className="no-print p-5">
        <h2 className="font-serif text-lg font-semibold mb-2">Past digests</h2>
        {archive.length ? (
          <ul className="divide-y divide-line text-sm">
            {archive.map((a) => (
              <li key={a.id} className="py-2 flex flex-wrap gap-x-4">
                <Link className="text-accent hover:underline" href={`/digest/${a.id}`}>Week ending {formatDate(a.window_end, settings.timezone)}</Link>
                <span className="text-ink-3">prepared {formatDateTime(a.generated_at, settings.timezone)}</span>
                <span className="text-ink-3">{DELIVERY_LABEL[a.delivery_status] ?? ""}</span>
                {a.data_mode === "demo" && <span className="text-synthetic">Demo</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-3">No digests yet.</p>}
      </Card>
    </div>
  );
}
