import { verifyCronRequest } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { generateDigest } from "@/lib/digest/generate";
import { errorResponse } from "@/lib/http";
import { runRefresh } from "@/lib/pipeline/ingest";
import { loadSettings } from "@/lib/settings/store";
import { dateKey } from "@/lib/time/window";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Monday-morning job (Vercel Cron, "30 0 * * 1" UTC = 06:00 IST).
 * Idempotent: the refresh uses run_key "weekly:<IST date>" and the digest is
 * keyed by "live:<IST date>" with an atomic delivery claim, so a duplicate
 * invocation neither re-fetches nor re-sends.
 */
async function handle(req: Request) {
  if (!verifyCronRequest(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = getDb();
    const { settings } = await loadSettings(db);
    if (!settings.digest.enabled) return Response.json({ skipped: "Weekly digest disabled in Settings" });
    const now = new Date();
    const key = `weekly:${dateKey(now, settings.timezone)}`;
    const refresh = await runRefresh(db, { trigger: "cron", runKey: key, now });
    const digest = await generateDigest(db, { mode: "live", trigger: "cron", now });
    return Response.json({ runKey: key, refresh, digest });
  } catch (err) {
    return errorResponse(err, "Weekly digest job");
  }
}

export const GET = handle;
export const POST = handle;
