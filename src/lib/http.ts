import { DbNotConfiguredError } from "./db/client";

/** Converts unexpected errors into safe JSON responses (no stack traces or secrets). */
export function errorResponse(err: unknown, context: string): Response {
  if (err instanceof DbNotConfiguredError) {
    return Response.json({ error: "Database is not configured (DATABASE_URL missing)." }, { status: 503 });
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, msg);
  const safe = msg
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[connection string]")
    .replace(/AIza[\w-]+/g, "[key]")
    .slice(0, 200);
  return Response.json({ error: `${context} failed: ${safe}` }, { status: 500 });
}

export async function readJson(req: Request, maxBytes = 50_000): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new BadRequest("Expected application/json");
  const text = await req.text();
  if (text.length > maxBytes) throw new BadRequest("Request body too large");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new BadRequest("Malformed JSON");
  }
}

export class BadRequest extends Error {}

export function badRequest(msg: string, issues?: string[]) {
  return Response.json({ error: msg, issues }, { status: 400 });
}
