import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";

/** In-process PostgreSQL (PGlite) running the real migrations. */
export async function createTestDb(): Promise<Db & { close: () => Promise<void> }> {
  const pg = new PGlite();
  const make = (exec: { query: PGlite["query"] }): Db => ({
    query: async <T>(text: string, params: unknown[] = []) => (await exec.query<T>(text, params as never[])).rows,
    tx: async (fn) => fn(make(exec)),
  });
  const db: Db & { close: () => Promise<void> } = {
    query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params as never[])).rows,
    tx: async <T>(fn: (q: Db) => Promise<T>) => pg.transaction(async (tx) => fn(make(tx as unknown as { query: PGlite["query"] }))),
    close: () => pg.close(),
  };
  await runMigrations(db);
  return db;
}
