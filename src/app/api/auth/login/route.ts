import { authConfigured, checkAccessCode, createSessionToken, SESSION_COOKIE, sameOrigin, sessionCookieOptions } from "@/lib/auth";
import { getDb, isDbConfigured } from "@/lib/db/client";
import { BadRequest, badRequest, readJson } from "@/lib/http";
import { takeCooldown } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: "Sign-in is not configured on this deployment." }, { status: 503 });
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request rejected" }, { status: 403 });
  try {
    const body = (await readJson(req, 2000)) as { code?: unknown };
    if (!checkAccessCode(body.code)) {
      // Slow down guessing: one failed attempt per 3 seconds globally.
      if (isDbConfigured()) await takeCooldown(getDb(), "login-fail", 3);
      return Response.json({ error: "Incorrect access code" }, { status: 401 });
    }
    const res = Response.json({ ok: true });
    const opts = sessionCookieOptions;
    res.headers.append(
      "set-cookie",
      `${SESSION_COOKIE}=${createSessionToken()}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; SameSite=Lax${opts.secure ? "; Secure" : ""}`,
    );
    return res;
  } catch (err) {
    if (err instanceof BadRequest) return badRequest(err.message);
    return Response.json({ error: "Sign-in failed" }, { status: 500 });
  }
}
