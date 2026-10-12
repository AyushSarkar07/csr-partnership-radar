import { z } from "zod";
import { requireSameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { BadRequest, badRequest, errorResponse, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const schema = z.object({ enabled: z.boolean() });

/** Enable/disable a registry source. URLs cannot be changed here (no arbitrary URL fetching). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/sources/[id]">) {
  const denied = requireSameOrigin(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return badRequest("Body must be { enabled: boolean }");
    const db = getDb();
    const rows = await db.query<{ id: string; retrieval_method: string }>(
      "update sources set enabled=$2, updated_at=now() where id=$1 and retrieval_method <> 'link_only' returning id, retrieval_method",
      [id, parsed.data.enabled],
    );
    if (!rows.length) return Response.json({ error: "Unknown source, or a link-only source that cannot be fetched" }, { status: 404 });
    await db.query("insert into audit_events (actor, action, entity, entity_id, details) values ('ananya','source.toggle','source',$1,$2::jsonb)", [id, JSON.stringify(parsed.data)]);
    return Response.json({ id, enabled: parsed.data.enabled });
  } catch (err) {
    if (err instanceof BadRequest) return badRequest(err.message);
    return errorResponse(err, "Update source");
  }
}
