import { getDb } from "@/lib/db/client";
import { errorResponse } from "@/lib/http";
import { latestDigest, parseSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const mode = new URL(req.url).searchParams.get("mode") === "demo" ? "demo" : "live";
    const d = await latestDigest(getDb(), mode);
    if (!d) return Response.json({ error: `No ${mode} digest has been generated yet.` }, { status: 404 });
    return Response.json({ ...d, summary: parseSummary(d.summary) });
  } catch (err) {
    return errorResponse(err, "Load digest");
  }
}
