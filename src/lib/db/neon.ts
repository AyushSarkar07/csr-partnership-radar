import { Pool, neonConfig } from "@neondatabase/serverless";
import type { Db } from "./types";

export function createNeonDb(connectionString: string): Db & { end: () => Promise<void> } {
  if (typeof globalThis.WebSocket !== "undefined") {
    neonConfig.webSocketConstructor = globalThis.WebSocket;
  }
  const pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 10_000 });
  // An idle connection dropped by the server must not crash the function.
  pool.on("error", (err: Error) => console.error("[db] pool error:", err.message));

  const db: Db & { end: () => Promise<void> } = {
    end: () => pool.end(),
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pool.query(text, params);
      return res.rows as T[];
    },
    async tx<T>(fn: (q: Db) => Promise<T>) {
      const client = await pool.connect();
      const q: Db = {
        query: async <R>(text: string, params: unknown[] = []) =>
          (await client.query(text, params)).rows as R[],
        tx: (inner) => inner(q),
      };
      try {
        await client.query("begin");
        const out = await fn(q);
        await client.query("commit");
        return out;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
  return db;
}

