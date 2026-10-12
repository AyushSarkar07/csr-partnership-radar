import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lightweight single-user access control:
 *  - Reads are public (except private review notes).
 *  - Mutations (reviews, settings, refresh, digest generation, source toggles)
 *    require a signed, HTTP-only session cookie obtained with ACCESS_CODE.
 *  - Scheduled jobs require `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this).
 * Fails closed: if ACCESS_CODE / SESSION_SECRET / CRON_SECRET are unset, the
 * corresponding privileged operations are refused.
 */

export const SESSION_COOKIE = "csr_session";
const SESSION_DAYS = 7;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab); // keep timing roughly constant
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

export function authConfigured(): boolean {
  return Boolean(process.env.ACCESS_CODE && secret());
}

export function checkAccessCode(code: unknown): boolean {
  const expected = process.env.ACCESS_CODE;
  if (!expected || !secret() || typeof code !== "string") return false;
  return safeEqual(code.trim(), expected);
}

export function createSessionToken(now = Date.now()): string {
  const s = secret();
  if (!s) throw new Error("SESSION_SECRET not configured");
  const exp = String(now + SESSION_DAYS * 86_400_000);
  const sig = createHmac("sha256", s).update(`v1.${exp}`).digest("base64url");
  return `v1.${exp}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null, now = Date.now()): boolean {
  const s = secret();
  if (!s || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return false;
  const expected = createHmac("sha256", s).update(`v1.${exp}`).digest("base64url");
  return safeEqual(sig, expected);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function isSignedIn(req: Request): boolean {
  return verifySessionToken(readCookie(req, SESSION_COOKIE));
}

/** CSRF defence in depth: if an Origin header is present it must match the request host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Returns an error Response when the request may not mutate state, else null. */
export function requireWriteAccess(req: Request): Response | null {
  if (!authConfigured()) {
    return Response.json({ error: "Write access is disabled: ACCESS_CODE and SESSION_SECRET are not configured on the server." }, { status: 503 });
  }
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request rejected" }, { status: 403 });
  if (!isSignedIn(req)) return Response.json({ error: "Sign in with the access code to make changes." }, { status: 401 });
  return null;
}

export function verifyCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) return false;
  const header = req.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${expected}`);
}
