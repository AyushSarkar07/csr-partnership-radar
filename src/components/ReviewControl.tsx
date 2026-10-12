"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { REVIEW_LABEL, REVIEW_STATUSES, type ReviewStatus } from "@/lib/repo/opportunities";

export function ReviewControl({ id, current }: { id: string; current: ReviewStatus | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<ReviewStatus>(current ?? "contact_this_week");
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "error"; msg?: string }>({ kind: "idle" });


  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState({ kind: "busy" });
        const res = await fetch(`/api/opportunities/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status, note: note.trim() || null }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return setState({ kind: "error", msg: json.error ?? "Could not save" });
        setNote("");
        setState({ kind: "ok", msg: `Saved: ${REVIEW_LABEL[status]}` });
        router.refresh();
      }}
    >
      <label className="block text-sm">
        <span className="text-ink-2">Decision</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus)} className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-2">
          {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-ink-2">Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="e.g. Spoke to CSR head; send proposal by Friday" className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-2" />
      </label>
      <button type="submit" disabled={state.kind === "busy"} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-60">
        {state.kind === "busy" ? "Saving…" : "Save decision"}
      </button>
      {state.msg && <p role="status" className={state.kind === "error" ? "text-sm text-danger" : "text-sm text-high"}>{state.msg}</p>}
    </form>
  );
}
