import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DATA_DIR } from "@/db";
import { resetProgress } from "@/lib/server/training";

export const dynamic = "force-dynamic";

const Body = z.object({ confirm: z.literal("RESET", { message: 'Type RESET to confirm' }) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  resetProgress();
  fs.rmSync(path.join(DATA_DIR, "uploads"), { recursive: true, force: true });
  return NextResponse.json({ ok: true });
}
