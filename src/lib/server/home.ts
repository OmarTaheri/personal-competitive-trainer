import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONCEPTS, CONCEPT_BY_ID } from "@/lib/concepts";
import { level as masteryLevel } from "@/lib/engine/mastery";
import type { GroupMastery } from "@/lib/character";
import { getAccount, getSettings, today } from "./settings";
import { activeBoosts, cfWindow, focusConcepts, getPlan, masteryMap, minutesSeries, trackProgress, weakConcepts } from "./training";
import { upcomingContests } from "./sync";
import { getStatus } from "./status";

export function groupMastery(): GroupMastery[] {
  const mm = masteryMap();
  const groups = [...new Set(CONCEPTS.map((c) => c.group))];
  return groups.map((g) => {
    const cs = CONCEPTS.filter((c) => c.group === g).map((c) => ({ c, m: mm.get(c.id) })).filter((x) => x.m);
    if (!cs.length) return { group: g, score: null, attempts: 0, status: "new" as const };
    const attempts = cs.reduce((s, x) => s + x.m!.attempts, 0);
    const score = cs.reduce((s, x) => s + x.m!.score * x.m!.attempts, 0) / attempts;
    const anyWeak = cs.some((x) => x.m!.weak);
    const worst = [...cs].sort((a, b) => a.m!.score - b.m!.score)[0];
    const lv = anyWeak ? "weak" : masteryLevel(score, attempts);
    return { group: g, score, attempts, status: lv, weakest: worst.c.name };
  });
}

export type ConceptKey = {
  id: string; key: string; name: string; group: string;
  score: number | null; attempts: number; status: "strong" | "learning" | "weak" | "new"; focus: boolean;
};

/** One entry per concept for the concept keyboard. `focus` = struggled with today, or boosted. */
export function conceptKeys(): ConceptKey[] {
  const mm = masteryMap();
  const d = today(getSettings());
  const focus = new Set([...focusConcepts(d), ...activeBoosts(d)]);
  return CONCEPTS.map((c) => {
    const m = mm.get(c.id);
    const status = m?.weak ? "weak" : masteryLevel(m?.score, m?.attempts);
    return { id: c.id, key: c.key, name: c.name, group: c.group, score: m?.score ?? null, attempts: m?.attempts ?? 0, status, focus: focus.has(c.id) };
  });
}

export function homeData() {
  const s = getSettings();
  const status = getStatus();
  const plan = getPlan(today(s));
  const left = plan.queue.filter((i) => !i.done && !i.skipped);
  const byTrack: Record<string, number> = {};
  // Re-solves are counted under their original track so nothing gives them away.
  for (const i of left) {
    const t = i.trackId === "review" ? "neetcode250" : i.trackId;
    byTrack[t] = (byTrack[t] ?? 0) + 1;
  }
  const mm = masteryMap();
  const weak = weakConcepts().slice(0, 3).map((id) => ({ id, name: CONCEPT_BY_ID.get(id)?.name ?? id, score: mm.get(id)!.score, attempts: mm.get(id)!.attempts }));
  const learning = [...mm.values()].filter((m) => !m.weak).sort((a, b) => a.score - b.score).slice(0, 3 - weak.length)
    .map((m) => ({ id: m.conceptId, name: CONCEPT_BY_ID.get(m.conceptId)?.name ?? m.conceptId, score: m.score, attempts: m.attempts }));
  return {
    name: s.displayName,
    timezone: s.timezone,
    status,
    queueLeft: left.length,
    queueMin: left.reduce((m, i) => m + i.expectedMin, 0),
    byTrack,
    series: minutesSeries(90),
    weak,
    learning,
    groups: groupMastery(),
    keys: conceptKeys(),
    solvedAlonePct: solvedAlonePct(),
    neetcode: trackProgress("neetcode250"),
    cses: trackProgress("cses"),
    cfWindow: cfWindow(),
    cfRating: getAccount("codeforces")?.rating ?? null,
    contests: upcomingContests(30, Date.now()),
  };
}

/** Share of finished attempts solved with no help: the "accuracy" number. */
function solvedAlonePct(): number | null {
  const db = getDb();
  const rows = db.select({ r: schema.attempts.result, h: schema.attempts.helpUsed }).from(schema.attempts).where(eq(schema.attempts.status, "done")).all();
  if (!rows.length) return null;
  return Math.round((100 * rows.filter((x) => x.r === "solved" && x.h === "none").length) / rows.length);
}
