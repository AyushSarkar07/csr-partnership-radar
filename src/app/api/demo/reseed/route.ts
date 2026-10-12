import { requireSameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { errorResponse } from "@/lib/http";
import { seedDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** Resets ONLY synthetic demo records (live data is never touched). */
export async function POST(req: Request) {
  const denied = requireSameOrigin(req);
  if (denied) return denied;
  try {
    const db = getDb();
    const r = await seedDemoData(db, { reset: true });
    await db.query("insert into audit_events (actor, action, details) values ('ananya','demo.reseed',$1::jsonb)", [JSON.stringify(r)]);
    return Response.json(r);
  } catch (err) {
    return errorResponse(err, "Reset demo data");
  }
}
