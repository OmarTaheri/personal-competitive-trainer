import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { rebuildPlan } from "@/lib/server/training";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { joined } = (await req.json()) as { joined: boolean };
  getDb().update(schema.contests).set({ joined: !!joined }).where(eq(schema.contests.id, Number(id))).run();
  // A joined contest today shrinks today's goal.
  rebuildPlan();
  return NextResponse.json({ ok: true });
}
