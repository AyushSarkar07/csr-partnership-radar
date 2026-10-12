export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-80 rounded bg-surface-2" />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-surface-2" />)}</div>
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-surface-2" />)}
    </div>
  );
}
