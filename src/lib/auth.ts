import { timingSafeEqual } from "node:crypto";

/**
 * Access model: the app is open — anyone with the URL can read and make changes
 * (reviews, settings, refresh, digest generation). There is no sign-in.
 * Remaining protections:
 *  - Mutations must come from the app's own origin (blocks cross-site form/fetch abuse).
 *  - Expensive operations have DB-backed cooldowns (src/lib/ratelimit.ts).
 *  - The scheduled job requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this).
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab); // keep timing roughly constant
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** CSRF defence: if an Origin header is present it must match the request host. */
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

/** Returns an error Response for cross-origin mutation attempts, else null. */
export function requireSameOrigin(req: Request): Response | null {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request rejected" }, { status: 403 });
  return null;
}

export function verifyCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) return false;
  const header = req.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${expected}`);
}
