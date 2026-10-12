import { runRefresh } from "../src/lib/pipeline/ingest";
import { scriptDb } from "./_db";

/**
 * Mac-side collector: fetches ONLY the sources marked config.runner = "local"
 * (NGOBox, FundsForNGOs, GDELT, which block or rate-limit Vercel's datacenter IPs)
 * and processes them with the same pipeline. Run with --prod to write to production.
 * Scheduled by ~/Library/LaunchAgents/com.csrradar.collector.plist (see scripts/install-mac-collector.sh).
 */
async function main() {
  const db = scriptDb();
  const started = new Date();
  try {
    const r = await runRefresh(db, { trigger: "collector", runner: "local" });
    console.log(`[${started.toISOString()}] collector ${r.status}: fetched=${r.itemsFetched} new=${r.itemsNew} dup=${r.itemsDuplicate} classified=${r.classified} aiFailed=${r.aiFailed}`);
    for (const s of r.sources) console.log(`  ${s.ok ? "OK  " : "FAIL"} ${s.sourceId} fetched=${s.fetched} candidates=${s.candidates} new=${s.new}${s.error ? " error=" + s.error : ""}`);
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error(`[${new Date().toISOString()}] collector error:`, e.message); process.exitCode = 1; });
