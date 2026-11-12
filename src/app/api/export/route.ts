import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { DATA_DIR } from "@/db";

/** Download a consistent backup copy of the database. */
export async function GET() {
  const tmp = path.join(os.tmpdir(), `cp-backup-${Date.now()}.db`);
  const db = new Database(path.join(DATA_DIR, "app.db"), { readonly: true });
  await db.backup(tmp);
  db.close();
  const buf = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buf, { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="cp-training-${date}.db"` } });
}
