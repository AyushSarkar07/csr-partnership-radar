import type { Db } from "./db/types";

/**
 * Atomic cooldown for expensive operations (refresh, digest generation).
 * Returns null when allowed, or the seconds remaining when limited.
 */
export async function takeCooldown(db: Db, key: string, seconds: number): Promise<number | null> {
  const ok = await db.query<{ key: string }>(
    `insert into rate_limits (key, last_at) values ($1, now())
     on conflict (key) do update set last_at = now()
       where rate_limits.last_at < now() - make_interval(secs => $2)
     returning key`,
    [key, seconds],
  );
  if (ok.length) return null;
  const row = await db.query<{ remaining: number }>(
    "select greatest(0, ceil($2 - extract(epoch from (now() - last_at))))::int as remaining from rate_limits where key=$1",
    [key, seconds],
  );
  return row[0]?.remaining ?? seconds;
}
