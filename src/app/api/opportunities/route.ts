import { isSignedIn } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { errorResponse } from "@/lib/http";
import { getDashboard } from "@/lib/queries";
import { parseFilters } from "@/lib/repo/filters";
import { loadSettings } from "@/lib/settings/store";
import { toApiOpportunity } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const db = getDb();
    const { settings } = await loadSettings(db);
    const filters = parseFilters(new URL(req.url).searchParams, { mode: settings.dataMode.defaultMode, days: settings.reportingWindowDays });
    const d = await getDashboard(db, filters);
    const authed = isSignedIn(req);
    return Response.json({
      mode: filters.mode,
      window: { start: d.window.start, end: d.window.end, days: d.window.days, timezone: d.window.timezone },
      filters,
      metrics: d.metrics,
      count: d.shown.length,
      opportunities: d.shown.map((o) => toApiOpportunity(o, authed)),
    });
  } catch (err) {
    return errorResponse(err, "List opportunities");
  }
}
