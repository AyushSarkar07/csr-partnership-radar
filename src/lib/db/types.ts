export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs fn inside a transaction. Nested calls reuse the outer transaction. */
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>;
}
