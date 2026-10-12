"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReseedButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          if (!confirm("Reset the demo data? Demo items and any decisions recorded on them return to their original state. Live data is not affected.")) return;
          setMsg("Resetting…");
          const res = await fetch("/api/demo/reseed", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
          const j = await res.json().catch(() => ({}));
          setMsg(res.ok ? `Demo data restored (${j.inserted - j.merged} items).` : j.error ?? "Failed");
          router.refresh();
        }}
        className="rounded-lg border border-synthetic/50 px-4 py-2 text-sm text-synthetic hover:bg-synthetic-bg"
      >
        Reset demo data
      </button>
      {msg && <span role="status" className="text-sm text-ink-2">{msg}</span>}
    </div>
  );
}
