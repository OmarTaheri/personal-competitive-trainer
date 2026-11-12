import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/db";
import { addImage, getAttempt } from "@/lib/server/training";

export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" };

export async function POST(req: Request) {
  const form = await req.formData();
  const attemptId = Number(form.get("attemptId"));
  const file = form.get("file");
  if (!attemptId || !getAttempt(attemptId)) return NextResponse.json({ error: "unknown attempt" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "only images are allowed" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "image too large (15 MB max)" }, { status: 400 });
  const key = `${attemptId}/${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const dest = path.join(DATA_DIR, "uploads", key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  addImage(attemptId, key, (form.get("caption") as string) || undefined);
  return NextResponse.json({ url: `/api/uploads/${key}` });
}
