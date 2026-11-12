import { NextResponse } from "next/server";
import { isSyncing, recentSyncLog, syncAll, syncContests, syncProblems, syncSolves } from "@/lib/server/sync";
import { rebuildPlan } from "@/lib/server/training";
import { recomputeRatings } from "@/lib/server/ratings";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export function GET() {
  return NextResponse.json({ running: isSyncing(), log: recentSyncLog(40) });
}

export async function POST(req: Request) {
  const { kind = "all", platform, wait = false } = (await req.json().catch(() => ({}))) as { kind?: string; platform?: string; wait?: boolean };
  const job = async () => {
    if (kind === "problems" && platform) return { [kind]: await syncProblems(platform) };
    if (kind === "solves" && platform) return { [kind]: await syncSolves(platform) };
    if (kind === "ratings") return { ratings: { ok: true, message: recomputeRatings() } };
    if (kind === "contests") return { contests: await syncContests() };
    return syncAll(kind as "all" | "solves" | "problems");
  };
  const run = job().then((r) => { if (kind !== "contests") rebuildPlan(); return r; });
  if (wait) return NextResponse.json(await run);
  void run.catch((e) => console.error("[sync]", e));
  return NextResponse.json({ started: true });
}
