import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Manual check-off (e.g. CSES, or anything solved outside the app). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { solved } = (await req.json()) as { solved: boolean };
  getDb().update(schema.problems).set({ solved: !!solved, solvedAt: solved ? Date.now() : null, solvedSource: solved ? "manual" : null }).where(eq(schema.problems.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
