import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./types";

/** Applies db/migrations/*.sql in filename order, recording each in schema_migrations. */
export async function runMigrations(db: Db, dir = path.join(process.cwd(), "db", "migrations")) {
  await db.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await db.tx(async (q) => {
      for (const stmt of splitSql(sql)) await q.query(stmt);
      await q.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    ran.push(file);
  }
  return ran;
}

/** Splits a migration into statements (no dollar-quoted bodies are used in our migrations). */
export function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
