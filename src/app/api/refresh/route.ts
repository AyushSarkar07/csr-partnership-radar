import { requireSameOrigin } from "@/lib/auth";
import { LIMITS } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { errorResponse } from "@/lib/http";
import { runRefresh } from "@/lib/pipeline/ingest";
import { takeCooldown } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Manual "Refresh intelligence": fetch sources, store, dedupe, classify with Gemini, score. */
export async function POST(req: Request) {
  const denied = requireSameOrigin(req);
  if (denied) return denied;
  try {
    const db = getDb();
    const wait = await takeCooldown(db, "refresh", LIMITS.refreshCooldownSeconds);
    if (wait !== null) return Response.json({ error: `A refresh ran recently. Try again in ${wait}s.` }, { status: 429 });
    const result = await runRefresh(db, { trigger: "manual" });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err, "Refresh");
  }
}
