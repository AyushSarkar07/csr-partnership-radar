import { getDb } from "@/lib/db/client";
import { errorResponse } from "@/lib/http";
import { listSources } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ sources: await listSources(getDb()) });
  } catch (err) {
    return errorResponse(err, "List sources");
  }
}
