import { config } from "dotenv";
import { createNeonDb } from "../src/lib/db/neon";

config({ path: ".env.local", quiet: true });

export function scriptDb() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return createNeonDb(url);
}
