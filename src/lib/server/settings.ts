import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Settings } from "@/db/schema";
import { DEFAULT_ATCODER_TABLE, DEFAULT_CODECHEF_TABLE, type Table } from "@/lib/engine/rating";
import { dateInTz } from "@/lib/time";

export function getSettings(): Settings {
  const db = getDb();
  let s = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
  if (!s) {
    db.insert(schema.settings).values({ id: 1, atcoderTable: JSON.stringify(DEFAULT_ATCODER_TABLE), codechefTable: JSON.stringify(DEFAULT_CODECHEF_TABLE) }).run();
    s = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get()!;
  }
  return s;
}

export function updateSettings(patch: Partial<Settings>) {
  getSettings();
  const { id: _id, ...rest } = patch;
  getDb().update(schema.settings).set(rest).where(eq(schema.settings.id, 1)).run();
}

export function today(s: Settings = getSettings()): string {
  return dateInTz(Date.now(), s.timezone);
}

export function tables(s: Settings): { atcoder: Table; codechef: Table } {
  const parse = (v: string | null, d: Table) => { try { return v ? (JSON.parse(v) as Table) : d; } catch { return d; } };
  return { atcoder: parse(s.atcoderTable, DEFAULT_ATCODER_TABLE), codechef: parse(s.codechefTable, DEFAULT_CODECHEF_TABLE) };
}

export function getAccount(platform: string) {
  return getDb().select().from(schema.accounts).where(eq(schema.accounts.platform, platform)).get();
}

export function setAccount(platform: string, handle: string) {
  const db = getDb();
  const h = handle.trim();
  if (!h) {
    db.delete(schema.accounts).where(eq(schema.accounts.platform, platform)).run();
    return;
  }
  const existing = getAccount(platform);
  if (existing) {
    if (existing.handle !== h) db.update(schema.accounts).set({ handle: h, lastSyncedAt: null, lastStatus: null, rating: null }).where(eq(schema.accounts.platform, platform)).run();
  } else {
    db.insert(schema.accounts).values({ platform, handle: h }).run();
  }
}
