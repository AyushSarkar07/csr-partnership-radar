import { generateDigest } from "../src/lib/digest/generate";
import { scriptDb } from "./_db";

async function main() {
  const mode = process.argv.includes("--demo") ? "demo" : "live";
  const db = scriptDb();
  try {
    console.log(JSON.stringify(await generateDigest(db, { mode, trigger: "manual" }), null, 2));
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
