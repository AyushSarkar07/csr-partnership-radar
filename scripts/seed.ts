import { seedDemoData } from "../src/lib/seed";
import { syncRegistry } from "../src/lib/sources/registry";
import { scriptDb } from "./_db";

/** Syncs the source registry and loads the synthetic demo dataset. `--reset-demo` wipes synthetic rows first. */
async function main() {
  const db = scriptDb();
  try {
    await syncRegistry(db);
    console.log("Source registry synced");
    const r = await seedDemoData(db, { reset: process.argv.includes("--reset-demo") });
    console.log(`Synthetic demo data: ${r.inserted} inserted, ${r.merged} merged as duplicates (${r.total} records in file)`);
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
