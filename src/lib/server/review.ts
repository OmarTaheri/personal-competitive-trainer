import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONCEPT_BY_ID } from "@/lib/concepts";
import { attemptValue } from "@/lib/engine/mastery";
import { addDays, startOfDayMs } from "@/lib/time";
import { getSettings, today } from "./settings";
import { goalFor, minutesOn, personalTimes } from "./training";
import { expectedMinutes } from "@/lib/engine/rating";

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export type WeeklyReview = ReturnType<typeof weeklyReview>;

/** Everything for the weekly review screen. `offset` 0 = this week, -1 = last week, … */
export function weeklyReview(offset = 0) {
  const s = getSettings();
  const db = getDb();
  const start = addDays(mondayOf(today(s)), offset * 7);
  const end = addDays(start, 7);
  const fromMs = startOfDayMs(start, s.timezone), toMs = startOfDayMs(end, s.timezone);
  const isCurrent = offset === 0;

  // ---- hours vs goal
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
    const future = d > today(s);
    return { date: d, minutes: future ? 0 : Math.round(minutesOn(d)), goal: goalFor(d), future };
  });
  const trained = days.reduce((m, d) => m + d.minutes, 0);
  const goal = days.reduce((m, d) => m + d.goal, 0);
  const daysHit = days.filter((d) => !d.future && d.minutes >= d.goal).length;

  // ---- attempts this week
  const rows = db.select({ a: schema.attempts, p: schema.problems }).from(schema.attempts)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.attempts.problemId))
    .where(and(eq(schema.attempts.status, "done"), gte(schema.attempts.startedAt, fromMs), lt(schema.attempts.startedAt, toMs)))
    .orderBy(asc(schema.attempts.startedAt)).all();
  const results = { solved: 0, solved_help: 0, gave_up: 0 } as Record<string, number>;
  for (const { a } of rows) results[a.result ?? "gave_up"] = (results[a.result ?? "gave_up"] ?? 0) + 1;

  // ---- what slowed you down
  const slowed = new Map<string, number>();
  for (const { a } of rows) for (const x of a.slowedBy) slowed.set(x, (slowed.get(x) ?? 0) + 1);

  // ---- topics: this week's average result vs the 4 weeks before
  const valueOf = (a: typeof schema.attempts.$inferSelect) => attemptValue({
    result: a.result as "solved", helpUsed: a.helpUsed as "none", felt: a.felt ?? 3, timeRatio: a.timeRatio ?? 1, slowedBy: a.slowedBy,
  });
  const prevRows = db.select({ a: schema.attempts }).from(schema.attempts)
    .where(and(eq(schema.attempts.status, "done"), gte(schema.attempts.startedAt, startOfDayMs(addDays(start, -28), s.timezone)), lt(schema.attempts.startedAt, fromMs))).all();
  const pids = [...new Set([...rows.map((r) => r.a.problemId), ...prevRows.map((r) => r.a.problemId)])];
  const conceptsBy = new Map<number, string[]>();
  if (pids.length) for (const pc of db.select().from(schema.problemConcepts).where(inArray(schema.problemConcepts.problemId, pids)).all()) conceptsBy.set(pc.problemId, [...(conceptsBy.get(pc.problemId) ?? []), pc.conceptId]);
  const agg = (list: (typeof schema.attempts.$inferSelect)[]) => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const a of list) for (const c of conceptsBy.get(a.problemId) ?? []) {
      const e = m.get(c) ?? { sum: 0, n: 0 };
      e.sum += valueOf(a); e.n++;
      m.set(c, e);
    }
    return m;
  };
  const now = agg(rows.map((r) => r.a)), before = agg(prevRows.map((r) => r.a));
  const topics = [...now.entries()].map(([c, v]) => {
    const b = before.get(c);
    const score = Math.round((100 * v.sum) / v.n);
    const prev = b ? Math.round((100 * b.sum) / b.n) : null;
    return { id: c, name: CONCEPT_BY_ID.get(c)?.name ?? c, score, prev, delta: prev == null ? null : score - prev, attempts: v.n };
  }).sort((x, y) => (x.delta ?? 0) - (y.delta ?? 0));

  // ---- re-solves: faster than the time before?
  const resolves = rows.filter((r) => r.a.isResolve).map(({ a, p }) => {
    const prev = db.select().from(schema.attempts)
      .where(and(eq(schema.attempts.problemId, a.problemId), eq(schema.attempts.status, "done"), lt(schema.attempts.startedAt, a.startedAt)))
      .orderBy(desc(schema.attempts.startedAt)).get();
    const nowSec = a.thinkSec + a.stuckSec + a.codeSec;
    const prevSec = prev ? prev.thinkSec + prev.stuckSec + prev.codeSec : null;
    return { title: p.title, url: p.url, result: a.result, prevResult: prev?.result ?? null, nowSec, prevSec, faster: prevSec != null && nowSec < prevSec };
  });

  // ---- your expected times (personal medians vs defaults)
  const times = [...personalTimes().entries()].map(([band, v]) => {
    const def = band.startsWith("LeetCode") ? expectedMinutes("leetcode", band.split(" ")[1], null) : expectedMinutes("codeforces", null, Number(band.split("-")[0]) + 100);
    return { band, minutes: v.minutes, samples: v.samples, def };
  }).sort((a, b) => a.band.localeCompare(b.band, undefined, { numeric: true }));

  const hasData = db.select({ n: sql<number>`count(*)` }).from(schema.attempts).where(lt(schema.attempts.startedAt, toMs)).get()!.n > 0;

  return {
    start, end: addDays(end, -1), offset, isCurrent, hasData,
    days, trained, goal, daysHit,
    total: rows.length, newCount: rows.filter((r) => !r.a.isResolve).length, results,
    slowed: [...slowed.entries()].sort((a, b) => b[1] - a[1]),
    topics, resolves, times,
  };
}
