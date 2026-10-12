"use client";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-10 text-center">
      <h1 className="font-serif text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-2">The page could not load. Stored data is unaffected.{error.digest ? ` (ref ${error.digest})` : ""}</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm text-surface">Try again</button>
    </div>
  );
}
