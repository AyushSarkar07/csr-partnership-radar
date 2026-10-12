import { runRefresh } from "../src/lib/pipeline/ingest";
import { scriptDb } from "./_db";

/** Runs the real live pipeline from the command line (same code as POST /api/refresh). */
async function main() {
  const db = scriptDb();
  try {
    const r = await runRefresh(db, { trigger: "manual" });
    console.log(JSON.stringify({ status: r.status, fetched: r.itemsFetched, new: r.itemsNew, duplicates: r.itemsDuplicate, classified: r.classified, aiFailed: r.aiFailed, aiPendingRemaining: r.aiPendingRemaining, aiNote: r.aiNote }, null, 2));
    for (const s of r.sources) console.log(`${s.ok ? "OK  " : "FAIL"} ${s.sourceId.padEnd(24)} fetched=${s.fetched} candidates=${s.candidates} new=${s.new} dup=${s.duplicates}${s.error ? " error=" + s.error : ""}`);
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
