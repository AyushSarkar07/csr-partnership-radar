"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourceToggle({ id, enabled, disabled }: { id: string; enabled: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? "Disable source" : "Enable source"}
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await fetch(`/api/sources/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) });
          setBusy(false);
          if (!res.ok) return setErr((await res.json().catch(() => ({}))).error ?? "Failed");
          router.refresh();
        }}
        className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-40 ${enabled ? "bg-high" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-all ${enabled ? "left-4" : "left-0.5"}`} />
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  );
}
