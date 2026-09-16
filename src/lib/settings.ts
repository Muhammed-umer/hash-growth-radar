import "server-only";
import { db } from "./db";
import { DEFAULT_SETTINGS, SETTING_KEYS, type SettingsShape } from "./config";

/** Defaults from config.ts, overridden by rows in the `settings` table. */
export async function getSettings(): Promise<SettingsShape> {
  const res = await db().from("settings").select("key, value");
  if (res.error) throw new Error(`settings: ${res.error.message}`);
  const out = structuredClone(DEFAULT_SETTINGS) as unknown as SettingsShape;
  for (const row of (res.data ?? []) as Array<{ key: string; value: unknown }>) {
    if ((SETTING_KEYS as string[]).includes(row.key)) {
      (out as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return out;
}

export async function saveSettings(patch: Partial<SettingsShape>): Promise<void> {
  const rows = Object.entries(patch)
    .filter(([k]) => (SETTING_KEYS as string[]).includes(k))
    .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
  if (rows.length === 0) return;
  const res = await db().from("settings").upsert(rows, { onConflict: "key" });
  if (res.error) throw new Error(`saveSettings: ${res.error.message}`);
}

/** Parse a textarea of one-item-per-line into a clean string list. */
export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
