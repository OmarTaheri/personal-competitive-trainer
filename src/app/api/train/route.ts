import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, today } from "@/lib/server/settings";
import {
  activeAttempt, discardAttempt, extendPlan, finishAttempt, getAttempt, getPlan, resume, setPhase, startAttempt, submitFeedback, useHelp,
} from "@/lib/server/training";
import { helpContent, trainView } from "@/lib/server/trainView";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(trainView());
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), problemId: z.number().int().optional() }),
  z.object({ action: z.literal("phase"), id: z.number().int(), phase: z.enum(["think", "stuck", "code", "paused"]), at: z.number().optional() }),
  z.object({ action: z.literal("resume"), id: z.number().int() }),
  z.object({ action: z.literal("help"), id: z.number().int(), level: z.enum(["hint", "editorial"]) }),
  z.object({ action: z.literal("finish"), id: z.number().int(), result: z.enum(["solved", "solved_help", "gave_up"]) }),
  z.object({
    action: z.literal("feedback"), id: z.number().int(), felt: z.number().int().min(1).max(5), keyIdea: z.string().trim().min(1, "Key idea is required"),
    slowedBy: z.array(z.string()).default([]), notes: z.string().optional(),
  }),
  z.object({ action: z.literal("discard"), id: z.number().int() }),
  z.object({ action: z.literal("more"), minutes: z.number().int().min(10).max(600).default(60) }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const b = parsed.data;
  try {
    switch (b.action) {
      case "start": {
        if (activeAttempt()) break;
        const date = today(getSettings());
        const plan = getPlan(date);
        const item = b.problemId != null ? plan.queue.find((i) => i.problemId === b.problemId && !i.done) : plan.queue.find((i) => !i.done && !i.skipped);
        if (item) startAttempt(item.problemId, item.trackId, item.kind === "upsolve" ? "upsolve" : "plan");
        else if (b.problemId != null) startAttempt(b.problemId, "manual", "manual");
        else return NextResponse.json({ error: "Nothing queued" }, { status: 400 });
        break;
      }
      case "phase": setPhase(b.id, b.phase, b.at); break;
      case "resume": resume(b.id); break;
      case "help": {
        const a = getAttempt(b.id);
        if (!a) return NextResponse.json({ error: "no attempt" }, { status: 404 });
        const s = getSettings();
        const stuck = a.stuckSec + (a.phase === "stuck" && a.phaseStartedAt ? (Date.now() - a.phaseStartedAt) / 1000 : 0);
        const need = (b.level === "hint" ? s.hintDelayMin : s.editorialDelayMin) * 60;
        if (stuck + 2 < need && a.status === "active") return NextResponse.json({ error: "Still locked — keep pushing!" }, { status: 403 });
        if (a.status === "active") useHelp(b.id, b.level);
        return NextResponse.json({ help: await helpContent(a.problemId, b.level), view: trainView() });
      }
      case "finish": finishAttempt(b.id, b.result); break;
      case "feedback": submitFeedback(b.id, { felt: b.felt, keyIdea: b.keyIdea, slowedBy: b.slowedBy, notes: b.notes }); break;
      case "discard": discardAttempt(b.id); break;
      case "more": extendPlan(b.minutes); break;
    }
    return NextResponse.json(trainView());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
