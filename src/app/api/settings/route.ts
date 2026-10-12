import { requireWriteAccess } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { BadRequest, badRequest, errorResponse, readJson } from "@/lib/http";
import { loadSettings, saveSettings } from "@/lib/settings/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await loadSettings(getDb()));
  } catch (err) {
    return errorResponse(err, "Load settings");
  }
}

export async function PUT(req: Request) {
  const denied = requireWriteAccess(req);
  if (denied) return denied;
  try {
    const result = await saveSettings(getDb(), await readJson(req), "ananya");
    if (!result.ok) return badRequest("Settings failed validation", result.issues);
    return Response.json(result);
  } catch (err) {
    if (err instanceof BadRequest) return badRequest(err.message);
    return errorResponse(err, "Save settings");
  }
}
