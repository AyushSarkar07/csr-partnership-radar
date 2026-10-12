import { getDb, isDbConfigured } from "@/lib/db/client";
import { getHealth } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Public health check. Reports configuration state only — never secret values. */
export async function GET() {
  const health = await getHealth(isDbConfigured() ? getDb() : null);
  return Response.json({ service: "csr-partnership-radar", time: new Date().toISOString(), ...health }, { status: health.ok ? 200 : 503 });
}
