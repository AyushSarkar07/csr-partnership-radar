import { runMigrations } from "../src/lib/db/migrate";
import { scriptDb } from "./_db";

const db = scriptDb();
runMigrations(db)
  .then((ran) => console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database already up to date"))
  .catch((e) => { console.error("Migration failed:", e.message); process.exitCode = 1; })
  .finally(() => db.end());
