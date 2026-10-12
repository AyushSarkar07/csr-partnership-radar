import { z } from "zod";
import { requireWriteAccess } from "@/lib/auth";
import { LIMITS } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { generateDigest } from "@/lib/digest/generate";
import { BadRequest, badRequest, errorResponse, readJson } from "@/lib/http";
import { takeCooldown } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({ mode: z.enum(["live", "demo"]).default("live") });

/** "Generate digest now". Idempotent per mode and IST date: re-running updates the same digest. */
export async function POST(req: Request) {
  const denied = requireWriteAccess(req);
  if (denied) return denied;
  try {
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) return badRequest("mode must be 'live' or 'demo'");
    const db = getDb();
    const wait = await takeCooldown(db, `digest:${parsed.data.mode}`, LIMITS.digestCooldownSeconds);
    if (wait !== null) return Response.json({ error: `Digest generated moments ago. Try again in ${wait}s.` }, { status: 429 });
    return Response.json(await generateDigest(db, { mode: parsed.data.mode, trigger: "manual" }));
  } catch (err) {
    if (err instanceof BadRequest) return badRequest(err.message);
    return errorResponse(err, "Generate digest");
  }
}
