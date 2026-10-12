/**
 * Chooses the database for the current runtime.
 *  - Vercel production → DATABASE_URL (production Neon database).
 *  - Local development → DEV_DATABASE_URL when present (separate Neon database),
 *    so local experiments never touch production data.
 *  - target "prod" (CLI `--prod`) → production database, deliberately.
 */
export function resolveDatabaseUrl(opts: { target?: "prod" | "dev"; unpooled?: boolean } = {}): string | undefined {
  const pick = (prefix: string) =>
    (opts.unpooled ? process.env[`${prefix}DATABASE_URL_UNPOOLED`] : undefined) || process.env[`${prefix}DATABASE_URL`];
  if (opts.target === "prod") return pick("");
  if (opts.target === "dev") return pick("DEV_");
  if (process.env.VERCEL_ENV !== "production" && process.env.DEV_DATABASE_URL) return pick("DEV_");
  return pick("");
}

export function describeDatabaseUrl(url: string | undefined): string {
  if (!url) return "none";
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "unparseable";
  }
}
