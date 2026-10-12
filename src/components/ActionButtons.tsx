"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type State = { kind: "idle" | "busy" | "ok" | "error"; message?: string };

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function ActionButtons({ mode }: { mode: "live" | "demo" }) {
  const router = useRouter();
  const [refresh, setRefresh] = useState<State>({ kind: "idle" });
  const [digest, setDigest] = useState<State>({ kind: "idle" });


  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {mode === "live" && (
          <button
            type="button"
            disabled={refresh.kind === "busy"}
            onClick={async () => {
              setRefresh({ kind: "busy", message: "Fetching sources and classifying with Gemini — this can take up to a minute…" });
              try {
                const r = await post("/api/refresh");
                const failed = r.sources.filter((s: { ok: boolean }) => !s.ok).length;
                setRefresh({
                  kind: failed && failed === r.sources.length ? "error" : "ok",
                  message: `Run ${r.status}: ${r.itemsFetched} items fetched, ${r.itemsNew} new, ${r.itemsDuplicate} duplicates, ${r.classified} classified${r.aiPendingRemaining ? `, ${r.aiPendingRemaining} still awaiting AI` : ""}${failed ? `, ${failed} source(s) failed` : ""}.${r.aiNote ? " " + r.aiNote : ""}`,
                });
                router.refresh();
              } catch (e) {
                setRefresh({ kind: "error", message: (e as Error).message });
              }
            }}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {refresh.kind === "busy" ? "Refreshing…" : refresh.kind === "error" ? "Retry refresh" : "Refresh intelligence"}
          </button>
        )}
        <button
          type="button"
          disabled={digest.kind === "busy"}
          onClick={async () => {
            setDigest({ kind: "busy", message: "Building the digest…" });
            try {
              const r = await post("/api/digest/generate", { mode });
              setDigest({ kind: "ok", message: `Digest ready (${r.items} items, overview by ${r.summarySource === "gemini" ? "Gemini" : "deterministic fallback"}). Delivery: ${r.delivery.detail}` });
              router.push(`/digest/${r.digestId}`);
            } catch (e) {
              setDigest({ kind: "error", message: (e as Error).message });
            }
          }}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {digest.kind === "busy" ? "Generating…" : `Generate ${mode === "demo" ? "demo " : ""}digest now`}
        </button>
      </div>
      {[refresh, digest].map((s, i) =>
        s.message ? (
          <p key={i} role="status" className={s.kind === "error" ? "text-sm text-danger" : s.kind === "busy" ? "text-sm text-ink-3" : "text-sm text-high"}>
            {s.message}
          </p>
        ) : null,
      )}
    </div>
  );
}
