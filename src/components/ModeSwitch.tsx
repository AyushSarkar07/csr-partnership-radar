import Link from "next/link";
import { cx } from "./ui";

export function ModeSwitch({ mode, basePath = "/", showDemo }: { mode: "live" | "demo"; basePath?: string; showDemo: boolean }) {
  const item = (m: "live" | "demo", label: string) => (
    <Link
      href={`${basePath}?mode=${m}`}
      aria-current={mode === m ? "page" : undefined}
      className={cx("px-3 py-1.5 text-sm rounded-md", mode === m ? (m === "live" ? "bg-high text-surface" : "bg-synthetic text-surface") : "text-ink-2 hover:bg-surface-2")}
    >
      {label}
    </Link>
  );
  return (
    <div role="group" aria-label="Data mode" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {item("live", "Live data")}
      {showDemo && item("demo", "Synthetic demo")}
    </div>
  );
}

export function ModeBanner({ mode, refLabel }: { mode: "live" | "demo"; refLabel: string }) {
  if (mode === "live") return null;
  return (
    <div className="rounded-lg border border-synthetic/40 bg-synthetic-bg px-4 py-2.5 text-sm text-synthetic">
      <strong>Synthetic demonstration data.</strong> Every company, headline and source below is fictional and exists to demonstrate the scoring, deduplication and review workflow. Windows are evaluated against a fixed reference time ({refLabel}). Synthetic records never appear in Live mode or live digests.
    </div>
  );
}
