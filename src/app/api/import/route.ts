import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { importNeetcodeTrack, parseCsv, type NeetcodeRow } from "@/lib/server/seed";
import { rebuildPlan } from "@/lib/server/training";

/**
 * kind = "neetcode": CSV with position,topic,title,difficulty,slug[,leetcode_url,video] — replaces the NeetCode track.
 * kind = "cses": paste the HTML of https://cses.fi/problemset/ while logged in — solved tasks get marked.
 */
export async function POST(req: Request) {
  const { kind, text } = (await req.json()) as { kind: string; text: string };
  if (!text?.trim()) return NextResponse.json({ error: "empty input" }, { status: 400 });
  if (kind === "neetcode") {
    const rows = parseCsv(text).map((r) => ({ ...r, position: Number(r.position) }) as NeetcodeRow);
    const bad = rows.find((r) => !r.slug || !r.title || !r.topic || !Number.isFinite(r.position));
    if (!rows.length || bad) return NextResponse.json({ error: "CSV needs columns position,topic,title,difficulty,slug" }, { status: 400 });
    importNeetcodeTrack(rows);
    rebuildPlan();
    return NextResponse.json({ ok: true, message: `Imported ${rows.length} problems` });
  }
  if (kind === "cses") {
    const ids = new Set<string>();
    for (const m of text.matchAll(/href="\/problemset\/task\/(\d+)\/?"[^<]*<\/a>\s*<span class="detail">[^<]*<\/span>\s*<span class="task-score icon full">/g)) ids.add(m[1]);
    const db = getDb();
    let n = 0;
    for (const id of ids) {
      n += db.update(schema.problems).set({ solved: true, solvedAt: Date.now(), solvedSource: "sync" }).where(and(eq(schema.problems.platform, "cses"), eq(schema.problems.externalId, id))).run().changes;
    }
    if (!ids.size) return NextResponse.json({ error: "No solved tasks found — paste the page source of cses.fi/problemset while logged in" }, { status: 400 });
    rebuildPlan();
    return NextResponse.json({ ok: true, message: `Marked ${n} CSES problems as solved (${ids.size} found)` });
  }
  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
