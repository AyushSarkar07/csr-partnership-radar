import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl p-10 text-center">
      <h1 className="font-serif text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-ink-2">This item may have been combined with another report of the same announcement.</p>
      <Link href="/" className="mt-4 inline-block text-accent underline">Back to opportunities</Link>
    </div>
  );
}
