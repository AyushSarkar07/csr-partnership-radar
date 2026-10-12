import type { Db } from "../db/types";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "./schema";

export interface StoredSettings {
  settings: Settings;
  version: number;
  updatedAt: string | null;
  persisted: boolean;
}

export async function loadSettings(db: Db): Promise<StoredSettings> {
  const rows = await db.query<{ settings: unknown; version: number; updated_at: string }>(
    "select settings, version, updated_at from user_settings where id = 1",
  );
  if (!rows[0]) return { settings: DEFAULT_SETTINGS, version: 0, updatedAt: null, persisted: false };
  // Stored settings are merged over defaults so newly added fields get sane values.
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(rows[0].settings as object) });
  return {
    settings: parsed.success ? parsed.data : DEFAULT_SETTINGS,
    version: rows[0].version,
    updatedAt: new Date(rows[0].updated_at).toISOString(),
    persisted: true,
  };
}

export async function saveSettings(db: Db, input: unknown, actor: string) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, issues: parsed.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`) };
  }
  const rows = await db.query<{ version: number }>(
    `insert into user_settings (id, settings, version, updated_at) values (1, $1::jsonb, 1, now())
     on conflict (id) do update set settings = excluded.settings,
       version = user_settings.version + 1, updated_at = now()
     returning version`,
    [JSON.stringify(parsed.data)],
  );
  await db.query(
    "insert into audit_events (actor, action, entity, entity_id, details) values ($1,'settings.update','user_settings','1',$2::jsonb)",
    [actor, JSON.stringify({ version: rows[0].version })],
  );
  return { ok: true as const, settings: parsed.data, version: rows[0].version };
}
