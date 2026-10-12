import "server-only";
import { createNeonDb } from "./neon";
import { resolveDatabaseUrl } from "./url";
import type { Db } from "./types";

let current: Db | null = null;

export function isDbConfigured(): boolean {
  return Boolean(current || resolveDatabaseUrl());
}

export function getDb(): Db {
  if (current) return current;
  const url = resolveDatabaseUrl();
  if (!url) throw new DbNotConfiguredError();
  current = createNeonDb(url);
  return current;
}

/** Used by tests (PGlite) and scripts to inject a database. */
export function setDb(db: Db | null) {
  current = db;
}

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
  }
}
