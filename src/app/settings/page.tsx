import { ReseedButton } from "@/components/ReseedButton";
import { SettingsForm } from "@/components/SettingsForm";
import { getDb } from "@/lib/db/client";
import { emailConfigStatus } from "@/lib/delivery/email";
import { getSession } from "@/lib/session";
import { loadSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const [{ settings, version, updatedAt }, session] = await Promise.all([loadSettings(db), getSession()]);
  const email = emailConfigStatus(true, "x");
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-ink-2">Validated on the server and persisted in Postgres{updatedAt ? ` (last saved ${new Date(updatedAt).toLocaleString("en-IN", { timeZone: settings.timezone })})` : " — currently using defaults"}. Source enable/disable lives on the <a href="/sources" className="underline">Sources</a> page.</p>
      </div>
      <SettingsForm key={version} initial={settings} version={version} signedIn={session.signedIn} emailMissing={email.missing} />
      {session.signedIn && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-serif text-lg font-semibold mb-2">Demo data</h2>
          <ReseedButton />
        </section>
      )}
    </div>
  );
}
