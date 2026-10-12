import Link from "next/link";
import { notFound } from "next/navigation";
import { DigestView } from "@/components/DigestView";
import { getDb } from "@/lib/db/client";
import { getDigest } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DigestById({ params }: PageProps<"/digest/[id]">) {
  const { id } = await params;
  const d = await getDigest(getDb(), id);
  if (!d) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-4">
      <Link href={`/digest?mode=${d.data_mode}`} className="no-print text-sm text-accent hover:underline">← All digests</Link>
      <DigestView d={d} />
    </div>
  );
}
