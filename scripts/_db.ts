import { config } from "dotenv";
import { createNeonDb } from "../src/lib/db/neon";
import { describeDatabaseUrl, resolveDatabaseUrl } from "../src/lib/db/url";

config({ path: ".env.local", quiet: true });

/**
 * CLI scripts target the DEV database by default. Pass `--prod` to act on the
 * production database deliberately (e.g. migrations before a deploy).
 */
export function scriptDb() {
  const target = process.argv.includes("--prod") ? "prod" : process.env.DEV_DATABASE_URL ? "dev" : "prod";
  const url = resolveDatabaseUrl({ target, unpooled: true });
  if (!url) throw new Error("No database URL found (see .env.example)");
  console.error(`[db] target=${target} host=${describeDatabaseUrl(url)}`);
  return createNeonDb(url);
}
