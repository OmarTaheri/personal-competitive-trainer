import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const g = globalThis as unknown as { __cpdb?: DB };

export const DATA_DIR = process.env.CP_DATA_DIR ?? path.join(process.cwd(), "data");

function open(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = process.env.CP_DB_FILE ?? path.join(DATA_DIR, "app.db");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export function getDb(): DB {
  if (!g.__cpdb) g.__cpdb = open();
  return g.__cpdb;
}

export { schema };
