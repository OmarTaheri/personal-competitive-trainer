import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/db";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif", heic: "image/heic" };

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const root = path.resolve(DATA_DIR, "uploads");
  const file = path.resolve(root, ...key);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return new Response("not found", { status: 404 });
  const ext = file.split(".").pop()!.toLowerCase();
  return new Response(fs.readFileSync(file), { headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" } });
}
