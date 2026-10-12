import { z } from "zod";
import { isSignedIn, requireWriteAccess } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { BadRequest, badRequest, errorResponse, readJson } from "@/lib/http";
import { getOpportunityDetail } from "@/lib/queries";
import { addReview, REVIEW_STATUSES } from "@/lib/repo/opportunities";
import { toApiOpportunity } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/opportunities/[id]">) {
  try {
    const { id } = await ctx.params;
    const d = await getOpportunityDetail(getDb(), id);
    if (!d) return Response.json({ error: "Not found" }, { status: 404 });
    const authed = isSignedIn(req);
    return Response.json({
      opportunity: toApiOpportunity(d.opp, authed),
      history: d.history.map((h) => ({ ...h, note: authed ? h.note : h.note ? "[private — sign in]" : null })),
      related: d.related,
    });
  } catch (err) {
    return errorResponse(err, "Load opportunity");
  }
}

const patchSchema = z.object({
  status: z.enum(REVIEW_STATUSES),
  note: z.string().trim().max(2000).optional().nullable(),
});

/** Records a human review decision. Append-only: history is never overwritten. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/opportunities/[id]">) {
  const denied = requireWriteAccess(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest("Invalid id");
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) return badRequest("Invalid review", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    const review = await addReview(getDb(), id, parsed.data.status, parsed.data.note || null, "ananya");
    if (!review) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ review });
  } catch (err) {
    if (err instanceof BadRequest) return badRequest(err.message);
    return errorResponse(err, "Save review");
  }
}
