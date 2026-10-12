"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
        setBusy(false);
        if (!res.ok) return setErr((await res.json().catch(() => ({}))).error ?? "Sign-in failed");
        router.push("/");
        router.refresh();
      }}
    >
      <label className="block text-sm">
        <span className="text-ink-2">Access code</span>
        <input type="password" autoComplete="current-password" required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" />
      </label>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-60">{busy ? "Checking…" : "Sign in"}</button>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
    </form>
  );
}
