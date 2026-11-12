import { and, asc, desc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Attempt, PlanItem, Problem } from "@/db/schema";
import { expectedMinutes, personalMinutes, timeBand } from "@/lib/engine/rating";
import { buildPlan, nextWindow, type Cand } from "@/lib/engine/planner";
import { failed, scheduleNew, scheduleResolve, type Outcome } from "@/lib/engine/scheduler";
import { isStruggle, updateScore } from "@/lib/engine/mastery";
import { addDays, dateInTz, startOfDayMs } from "@/lib/time";
import { conceptsOf, getProblem, getProblems, markProblemSolved } from "./problems";
import { getSettings, today } from "./settings";
import { ensureSeeded } from "./seed";

const db = () => getDb();

// ---------------------------------------------------------------- expected time (yours)

let personalCache: Map<string, { minutes: number | null; samples: number }> | null = null;

/**
 * Your own typical time per band: median of first-time attempts you solved (alone or
 * with help), per LeetCode difficulty / 200-rating band. Needs 5 samples per band.
 */
export function personalTimes() {
  if (personalCache) return personalCache;
  const rows = db()
    .select({ a: schema.attempts, p: schema.problems })
    .from(schema.attempts)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.attempts.problemId))
    .where(and(eq(schema.attempts.status, "done"), eq(schema.attempts.isResolve, false), inArray(schema.attempts.result, ["solved", "solved_help"])))
    .all();
  const by = new Map<string, number[]>();
  for (const { a, p } of rows) {
    const k = timeBand(p.platform, p.rawDifficulty, p.normRating);
    by.set(k, [...(by.get(k) ?? []), (a.thinkSec + a.stuckSec + a.codeSec) / 60]);
  }
  personalCache = new Map([...by].map(([k, v]) => [k, { minutes: personalMinutes(v), samples: v.length }]));
  return personalCache;
}

const invalidatePersonal = () => { personalCache = null; };

/** Expected minutes: your own median for this band once known, else the default. */
export const expectedFor = (p: Pick<Problem, "platform" | "rawDifficulty" | "normRating">) =>
  personalTimes().get(timeBand(p.platform, p.rawDifficulty, p.normRating))?.minutes ?? expectedMinutes(p.platform, p.rawDifficulty, p.normRating);

// ---------------------------------------------------------------- time

export function attemptSeconds(a: Attempt, now = Date.now()): { think: number; stuck: number; code: number; total: number } {
  let { thinkSec: think, stuckSec: stuck, codeSec: code } = a;
  if (a.status === "active" && a.phase !== "paused" && a.phaseStartedAt) {
    const run = Math.max(0, Math.floor((now - a.phaseStartedAt) / 1000));
    if (a.phase === "think") think += run;
    else if (a.phase === "stuck") stuck += run;
    else if (a.phase === "code") code += run;
  }
  return { think, stuck, code, total: think + stuck + code };
}

/** Minutes trained on a given date (attempts attributed to the day they started). */
export function minutesOn(date: string): number {
  const s = getSettings();
  const from = startOfDayMs(date, s.timezone), to = startOfDayMs(addDays(date, 1), s.timezone);
  const rows = db().select().from(schema.attempts).where(and(gte(schema.attempts.startedAt, from), lte(schema.attempts.startedAt, to - 1))).all();
  return rows.reduce((m, a) => m + attemptSeconds(a).total / 60, 0);
}

/** Minutes per day for the last `days` days (oldest first). */
export function minutesSeries(days: number): { date: string; minutes: number; solved: number }[] {
  const s = getSettings();
  const t = today(s);
  const start = addDays(t, -(days - 1));
  const from = startOfDayMs(start, s.timezone);
  const rows = db().select().from(schema.attempts).where(gte(schema.attempts.startedAt, from)).all();
  const map = new Map<string, { minutes: number; solved: number }>();
  for (let i = 0; i < days; i++) map.set(addDays(start, i), { minutes: 0, solved: 0 });
  for (const a of rows) {
    const d = dateInTz(a.startedAt, s.timezone);
    const e = map.get(d);
    if (!e) continue;
    e.minutes += attemptSeconds(a).total / 60;
    if (a.result === "solved" || a.result === "solved_help") e.solved++;
  }
  return [...map.entries()].map(([date, v]) => ({ date, minutes: Math.round(v.minutes), solved: v.solved }));
}

export function streak(): number {
  const series = minutesSeries(400);
  let n = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].minutes >= 15) n++;
    else if (i === series.length - 1) continue; // today not done yet doesn't break the streak
    else break;
  }
  return n;
}

// ---------------------------------------------------------------- XP / level

export function xpTotal(): number {
  const rows = db()
    .select({ a: schema.attempts, rating: schema.problems.normRating })
    .from(schema.attempts)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.attempts.problemId))
    .all();
  let xp = 0;
  for (const { a, rating } of rows) {
    const min = attemptSeconds(a).total / 60;
    xp += min * Math.max(0.8, (rating ?? 1200) / 1000);
    if (a.result === "solved") xp += 25;
    else if (a.result === "solved_help") xp += 10;
    if (a.status === "done") xp += 5; // feedback filled
  }
  return Math.round(xp);
}

export const xpForLevel = (l: number) => 50 * l * (l - 1);
export function levelFromXp(xp: number) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return { level: l, cur: xp - xpForLevel(l), need: xpForLevel(l + 1) - xpForLevel(l) };
}

// ---------------------------------------------------------------- mastery

export function masteryMap() {
  return new Map(db().select().from(schema.conceptMastery).all().map((m) => [m.conceptId, m]));
}

export function weakConcepts(): string[] {
  return db().select().from(schema.conceptMastery).where(eq(schema.conceptMastery.weak, true)).orderBy(asc(schema.conceptMastery.score)).all().map((m) => m.conceptId);
}

export function activeBoosts(date: string): string[] {
  return db().select().from(schema.topicBoosts).where(gte(schema.topicBoosts.until, date)).all().map((b) => b.conceptId);
}

// ---------------------------------------------------------------- plan

function attemptedIds(): number[] {
  return db().selectDistinct({ id: schema.attempts.problemId }).from(schema.attempts).all().map((r) => r.id);
}

function toCands(problems: Problem[]): Cand[] {
  const cm = conceptsOf(problems.map((p) => p.id));
  return problems.map((p) => ({ problemId: p.id, concepts: cm.get(p.id) ?? [], expectedMin: expectedFor(p), difficulty: p.rawDifficulty }));
}

function trackCandidates(trackId: string, exclude: number[], limit: number): Problem[] {
  const rows = db()
    .select({ p: schema.problems })
    .from(schema.trackItems)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.trackItems.problemId))
    .where(and(eq(schema.trackItems.trackId, trackId), eq(schema.problems.solved, false), exclude.length ? notInArray(schema.problems.id, exclude) : undefined))
    .orderBy(asc(schema.trackItems.position))
    .limit(limit)
    .all();
  return rows.map((r) => r.p);
}

export function cfWindow(): number {
  return db().select().from(schema.tracks).where(eq(schema.tracks.id, "codeforces")).get()?.windowLo ?? 800;
}

/** How today is going: +1 per fast clean solve, −1 per struggle, over the last 3 finished problems. */
export function momentum(date = today()): number {
  return Math.max(-2, Math.min(2, todaysResults(date).slice(0, 3).reduce((m, r) => m + (r.clean ? 1 : r.struggle ? -1 : 0), 0)));
}

/** Concepts you struggled with today (help, gave up, or slow), most recent first. Cleared once you solve that concept cleanly later. */
export function focusConcepts(date = today()): string[] {
  const res = todaysResults(date);
  const cm = conceptsOf(res.map((r) => r.problemId));
  const out: string[] = [];
  const cleared = new Set<string>();
  for (const r of res) {
    for (const c of cm.get(r.problemId) ?? []) {
      if (r.clean || r.result === "solved") cleared.add(c);
      else if (r.struggle && !cleared.has(c) && !out.includes(c)) out.push(c);
    }
  }
  return out.slice(0, 3);
}

function todaysResults(date: string) {
  const s = getSettings();
  return db().select().from(schema.attempts)
    .where(and(eq(schema.attempts.status, "done"), gte(schema.attempts.startedAt, startOfDayMs(date, s.timezone))))
    .orderBy(desc(schema.attempts.endedAt)).all()
    .map((a) => ({
      problemId: a.problemId,
      result: a.result,
      clean: a.result === "solved" && a.helpUsed === "none" && (a.timeRatio ?? 1) <= 0.8 && (a.felt ?? 3) <= 2,
      struggle: a.result !== "solved" || a.helpUsed !== "none" || (a.timeRatio ?? 0) > 1.5,
    }));
}

function cfCandidates(exclude: number[], shift = 0): Problem[] {
  const lo = Math.max(800, cfWindow() + shift);
  return db()
    .select()
    .from(schema.problems)
    .where(and(eq(schema.problems.platform, "codeforces"), eq(schema.problems.solved, false), gte(schema.problems.normRating, lo), lte(schema.problems.normRating, lo + 200), exclude.length ? notInArray(schema.problems.id, exclude) : undefined))
    .orderBy(sql`random()`)
    .limit(300)
    .all();
}

export function contestDay(date: string): boolean {
  const s = getSettings();
  const from = startOfDayMs(date, s.timezone), to = startOfDayMs(addDays(date, 1), s.timezone);
  return !!db().select().from(schema.contests).where(and(eq(schema.contests.joined, true), gte(schema.contests.startUtc, from), lte(schema.contests.startUtc, to - 1))).get();
}

function generate(date: string, goalMin: number, doneMin: number, existing: PlanItem[]): PlanItem[] {
  const s = getSettings();
  const attempted = attemptedIds();
  // Only not-yet-done items block a pick: a problem finished earlier today can come back as a same-day retry.
  const inQueue = existing.filter((i) => !i.done).map((i) => i.problemId);
  const exclude = [...new Set([...attempted, ...inQueue])];

  const due = db()
    .select({ r: schema.reviews, p: schema.problems })
    .from(schema.reviews)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.reviews.problemId))
    .where(and(eq(schema.reviews.status, "queued"), lte(schema.reviews.dueDate, date)))
    .orderBy(asc(schema.reviews.dueDate))
    .all()
    .filter((d) => retryReady(d.r.lastAttemptId, date));
  const lastTrack = new Map<number, string>();
  if (due.length) {
    const rows = db().select({ pid: schema.attempts.problemId, t: schema.attempts.trackId }).from(schema.attempts).where(inArray(schema.attempts.problemId, due.map((d) => d.p.id))).orderBy(asc(schema.attempts.startedAt)).all();
    for (const r of rows) if (r.t && r.t !== "review") lastTrack.set(r.pid, r.t);
  }
  // Re-solves already done today count against the cap.
  const reviewsToday = db()
    .select({ n: sql<number>`count(*)` })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.isResolve, true), gte(schema.attempts.startedAt, startOfDayMs(date, s.timezone))))
    .get()!.n;
  const reviewsQueued = existing.filter((i) => i.kind === "review" && !i.done).length;

  const ncProblems = trackCandidates("neetcode250", exclude, 400);
  const mom = momentum(date);
  const out = buildPlan({
    goalMin,
    doneMin,
    shares: { neetcode: s.shareNeetcode, codeforces: s.shareCodeforces, cses: s.shareCses },
    dueReviews: toCands(due.map((d) => d.p)).map((c) => ({ ...c, trackId: lastTrack.get(c.problemId) ?? "review" })),
    resolveCap: Math.max(0, s.resolveCap - reviewsToday - reviewsQueued),
    neetcode: toCands(ncProblems),
    codeforces: toCands(cfCandidates(exclude, mom * 100)),
    cses: toCands(trackCandidates("cses", exclude, 60)),
    upsolves: [], // contest problems are never pushed into training (a contest's last problems can be far too hard)
    weakConcepts: weakConcepts(),
    boostConcepts: [...new Set([...weakConcepts(), ...activeBoosts(date)])],
    weakEvery: s.weakEvery,
    focus: focusConcepts(date),
    momentum: mom,
    exclude: new Set(inQueue),
  });
  return out.items.map((i) => ({ ...i }));
}

/** A same-day retry waits until 3 other problems are done or 90 minutes have passed, so it isn't back-to-back. */
export const RETRY_AFTER_PROBLEMS = 3;
export const RETRY_AFTER_MIN = 90;
function retryReady(lastAttemptId: number | null, date: string): boolean {
  if (!lastAttemptId) return true;
  const last = getAttempt(lastAttemptId);
  const s = getSettings();
  if (!last?.endedAt || last.endedAt < startOfDayMs(date, s.timezone)) return true; // not from today
  if (Date.now() - last.endedAt >= RETRY_AFTER_MIN * 60e3) return true;
  const since = db().select({ n: sql<number>`count(*)` }).from(schema.attempts)
    .where(and(eq(schema.attempts.status, "done"), gte(schema.attempts.endedAt, last.endedAt + 1))).get()!.n;
  return since >= RETRY_AFTER_PROBLEMS;
}

export function goalFor(date: string): number {
  const s = getSettings();
  return Math.round(s.dailyGoalMin * (contestDay(date) ? s.contestDayFactor : 1));
}

export function getPlan(date = today()): { date: string; goalMin: number; queue: PlanItem[] } {
  ensureSeeded();
  const existing = db().select().from(schema.dailyPlans).where(eq(schema.dailyPlans.date, date)).get();
  if (existing) return existing;
  const goalMin = goalFor(date);
  const queue = generate(date, goalMin, minutesOn(date), []);
  db().insert(schema.dailyPlans).values({ date, queue, goalMin, createdAt: Date.now() }).onConflictDoNothing().run();
  return { date, goalMin, queue };
}

function savePlan(date: string, queue: PlanItem[]) {
  db().update(schema.dailyPlans).set({ queue }).where(eq(schema.dailyPlans.date, date)).run();
}

/** Rebuild the not-yet-done part of today's plan (e.g. after changing settings). */
export function rebuildPlan(date = today()) {
  const plan = getPlan(date);
  const kept = plan.queue.filter((i) => i.done || i.skipped || i.problemId === activeAttempt()?.problemId);
  const goalMin = goalFor(date);
  const fresh = generate(date, goalMin, minutesOn(date), kept);
  db().update(schema.dailyPlans).set({ queue: [...kept, ...fresh], goalMin }).where(eq(schema.dailyPlans.date, date)).run();
}

/** Add one more chunk of work when today's queue is empty ("train more"). */
export function extendPlan(extraMin = 60, date = today()) {
  const plan = getPlan(date);
  const done = minutesOn(date);
  const fresh = generate(date, done + extraMin, done, plan.queue);
  savePlan(date, [...plan.queue, ...fresh]);
  return fresh.length;
}

export function nextPlanItem(date = today()): PlanItem | null {
  let plan = getPlan(date);
  let item = plan.queue.find((i) => !i.done && !i.skipped);
  if (!item) {
    extendPlan(60, date);
    plan = getPlan(date);
    item = plan.queue.find((i) => !i.done && !i.skipped);
  }
  return item ?? null;
}

function markPlanDone(problemId: number, date: string) {
  const plan = db().select().from(schema.dailyPlans).where(eq(schema.dailyPlans.date, date)).get();
  if (!plan) return;
  savePlan(date, plan.queue.map((i) => (i.problemId === problemId ? { ...i, done: true } : i)));
}

// ---------------------------------------------------------------- attempts

export function activeAttempt(): Attempt | undefined {
  return db().select().from(schema.attempts).where(inArray(schema.attempts.status, ["active", "feedback"])).orderBy(desc(schema.attempts.startedAt)).get();
}

export function getAttempt(id: number) {
  return db().select().from(schema.attempts).where(eq(schema.attempts.id, id)).get();
}

export function startAttempt(problemId: number, trackId: string | null, source: "plan" | "manual" | "upsolve" = "plan"): Attempt {
  const cur = activeAttempt();
  if (cur) return cur;
  const p = getProblem(problemId);
  if (!p) throw new Error("problem not found");
  const prevDone = db().select({ id: schema.attempts.id }).from(schema.attempts).where(and(eq(schema.attempts.problemId, problemId), eq(schema.attempts.status, "done"))).get();
  const now = Date.now();
  return db()
    .insert(schema.attempts)
    .values({ problemId, trackId, source, isResolve: !!prevDone, status: "active", phase: "think", phaseStartedAt: now, startedAt: now, expectedMin: expectedFor(p) })
    .returning()
    .get();
}

function accumulate(a: Attempt, at: number) {
  const sec = attemptSeconds({ ...a }, at);
  return { thinkSec: sec.think, stuckSec: sec.stuck, codeSec: sec.code };
}

export function setPhase(id: number, phase: "think" | "stuck" | "code" | "paused", at?: number) {
  const a = getAttempt(id);
  if (!a || a.status !== "active") return a;
  const now = Date.now();
  const when = Math.min(now, Math.max(a.phaseStartedAt ?? now, at ?? now));
  if (phase === a.phase) return a;
  if (phase === "paused") {
    db().update(schema.attempts).set({ ...accumulate(a, when), phase: "paused", resumePhase: a.phase, phaseStartedAt: now }).where(eq(schema.attempts.id, id)).run();
  } else if (a.phase === "paused") {
    db().update(schema.attempts).set({ phase, resumePhase: null, phaseStartedAt: now }).where(eq(schema.attempts.id, id)).run();
  } else {
    db().update(schema.attempts).set({ ...accumulate(a, now), phase, phaseStartedAt: now }).where(eq(schema.attempts.id, id)).run();
  }
  return getAttempt(id);
}

export function resume(id: number) {
  const a = getAttempt(id);
  if (!a || a.phase !== "paused") return a;
  return setPhase(id, (a.resumePhase as "think" | "stuck" | "code") ?? "think");
}

export function useHelp(id: number, level: "hint" | "editorial") {
  const a = getAttempt(id);
  if (!a) return;
  const rank = { none: 0, hint: 1, editorial: 2 } as const;
  if (rank[level] > rank[a.helpUsed as keyof typeof rank]) db().update(schema.attempts).set({ helpUsed: level }).where(eq(schema.attempts.id, id)).run();
}

export type Reveal = { keyIdea: string | null; notes: string | null; images: string[]; totalSec: number; result: string | null; date: number } | null;

/** Previous attempt's notes — only ever returned after the attempt is finished. */
export function revealFor(attempt: Attempt): Reveal {
  if (!attempt.isResolve || attempt.status === "active") return null;
  const prev = db()
    .select()
    .from(schema.attempts)
    .where(and(eq(schema.attempts.problemId, attempt.problemId), eq(schema.attempts.status, "done"), sql`${schema.attempts.id} <> ${attempt.id}`))
    .orderBy(desc(schema.attempts.startedAt))
    .get();
  if (!prev) return null;
  const images = db().select().from(schema.attemptImages).where(eq(schema.attemptImages.attemptId, prev.id)).all().map((i) => `/api/uploads/${i.storageKey}`);
  return { keyIdea: prev.keyIdea, notes: prev.notes, images, totalSec: prev.thinkSec + prev.stuckSec + prev.codeSec, result: prev.result, date: prev.startedAt };
}

export function finishAttempt(id: number, result: "solved" | "solved_help" | "gave_up") {
  const a = getAttempt(id);
  if (!a || a.status !== "active") return a;
  const now = Date.now();
  const acc = a.phase === "paused" ? {} : accumulate(a, now);
  const helpUsed = result === "solved_help" && a.helpUsed === "none" ? "hint" : a.helpUsed;
  db().update(schema.attempts).set({ ...acc, status: "feedback", result, endedAt: now, phaseStartedAt: null, helpUsed }).where(eq(schema.attempts.id, id)).run();
  return getAttempt(id);
}

/** Abandon an attempt without recording it (e.g. opened by mistake). */
export function discardAttempt(id: number) {
  db().delete(schema.attempts).where(and(eq(schema.attempts.id, id), inArray(schema.attempts.status, ["active", "feedback"]))).run();
}

export type Feedback = { felt: number; keyIdea: string; slowedBy: string[]; notes?: string };

export function submitFeedback(id: number, f: Feedback) {
  const a = getAttempt(id);
  if (!a || a.status !== "feedback" || !a.result) throw new Error("attempt is not waiting for feedback");
  const s = getSettings();
  const p = getProblem(a.problemId)!;
  const totalSec = a.thinkSec + a.stuckSec + a.codeSec;
  const expected = a.expectedMin ?? expectedFor(p);
  const timeRatio = totalSec / 60 / expected;
  const result = a.result as Outcome["result"];
  const helpUsed = a.helpUsed as Outcome["helpUsed"];
  const outcome: Outcome = { result, helpUsed, felt: f.felt, timeRatio, totalSec };
  const date = today(s);

  db().transaction(() => {
    db().update(schema.attempts).set({ status: "done", felt: f.felt, keyIdea: f.keyIdea.trim(), slowedBy: f.slowedBy, notes: f.notes ?? null, timeRatio }).where(eq(schema.attempts.id, id)).run();

    // Mastery for each concept of this problem.
    const concepts = conceptsOf([p.id]).get(p.id) ?? [];
    let weak = false;
    for (const c of concepts) {
      const prev = db().select().from(schema.conceptMastery).where(eq(schema.conceptMastery.conceptId, c)).get();
      const next = updateScore(prev ?? null, { result, helpUsed, felt: f.felt, timeRatio, slowedBy: f.slowedBy }, struggleStreak(c));
      weak ||= next.weak;
      db().insert(schema.conceptMastery).values({ conceptId: c, ...next, lastSeen: Date.now() })
        .onConflictDoUpdate({ target: schema.conceptMastery.conceptId, set: { ...next, lastSeen: Date.now() } }).run();
    }

    // Spaced repetition.
    const rev = db().select().from(schema.reviews).where(eq(schema.reviews.problemId, p.id)).get();
    const opts = { weak, rng: Math.random };
    // Failed (gave up / read the solution) and the first try today → one retry later today, then the normal schedule.
    const retryToday = failed(outcome) && !triedEarlierToday(p.id, id, date);
    if (!rev) {
      const n = scheduleNew(outcome, opts);
      db().insert(schema.reviews).values({ problemId: p.id, dueDate: retryToday ? date : addDays(date, n.dueInDays), gapDays: n.gapDays, cleanStreak: 0, lastTimeSec: totalSec, lastAttemptId: id, reps: 0, updatedAt: Date.now() }).run();
    } else {
      const n = scheduleResolve(rev, outcome, opts);
      db().update(schema.reviews).set({
        dueDate: retryToday ? date : addDays(date, n.dueInDays), gapDays: n.gapDays, cleanStreak: n.cleanStreak, lastTimeSec: totalSec, lastAttemptId: id, reps: n.reps,
        status: n.retired ? "retired" : "queued", updatedAt: Date.now(),
      }).where(eq(schema.reviews.problemId, p.id)).run();
    }

    if (result !== "gave_up") markProblemSolved(p.id);
    db().update(schema.upsolves).set({ done: true }).where(eq(schema.upsolves.problemId, p.id)).run();
    markPlanDone(p.id, dateInTz(a.startedAt, s.timezone));
    markPlanDone(p.id, date);

    if (p.platform === "codeforces" && !a.isResolve) updateCfWindow();
    if (a.trackId === "neetcode250" || p.section) maybeBoostTopic(p, date);
  });
  invalidatePersonal();
  // Adapt: rebuild what's left of today using this result (time, help, concept).
  rebuildPlan(date);
  return getAttempt(id);
}

/** Struggles in a row on a concept, newest first (this attempt is already marked done). */
function struggleStreak(conceptId: string): number {
  const rows = db()
    .select({ a: schema.attempts })
    .from(schema.attempts)
    .innerJoin(schema.problemConcepts, eq(schema.problemConcepts.problemId, schema.attempts.problemId))
    .where(and(eq(schema.problemConcepts.conceptId, conceptId), eq(schema.attempts.status, "done")))
    .orderBy(desc(schema.attempts.endedAt))
    .limit(10)
    .all();
  let n = 0;
  for (const { a } of rows) {
    if (isStruggle({ result: a.result as Outcome["result"], helpUsed: a.helpUsed as Outcome["helpUsed"], timeRatio: a.timeRatio ?? 1 })) n++;
    else break;
  }
  return n;
}

function triedEarlierToday(problemId: number, attemptId: number, date: string): boolean {
  const s = getSettings();
  return !!db().select({ id: schema.attempts.id }).from(schema.attempts)
    .where(and(eq(schema.attempts.problemId, problemId), eq(schema.attempts.status, "done"), gte(schema.attempts.startedAt, startOfDayMs(date, s.timezone)), sql`${schema.attempts.id} <> ${attemptId}`))
    .get();
}

function updateCfWindow() {
  const t = db().select().from(schema.tracks).where(eq(schema.tracks.id, "codeforces")).get();
  if (!t) return;
  const lo = t.windowLo ?? 800;
  const rows = db()
    .select({ a: schema.attempts, r: schema.problems.normRating })
    .from(schema.attempts)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.attempts.problemId))
    .where(and(eq(schema.problems.platform, "codeforces"), eq(schema.attempts.status, "done"), eq(schema.attempts.isResolve, false), gte(schema.attempts.startedAt, t.windowChangedAt ?? 0)))
    .orderBy(asc(schema.attempts.startedAt))
    .all()
    .filter((x) => (x.r ?? 0) >= lo && (x.r ?? 0) <= lo + 200);
  const next = nextWindow(lo, rows.map((x) => ({ solvedNoEditorial: (x.a.result === "solved" || x.a.result === "solved_help") && x.a.helpUsed !== "editorial" })));
  if (next !== lo) db().update(schema.tracks).set({ windowLo: next, windowChangedAt: Date.now() }).where(eq(schema.tracks.id, "codeforces")).run();
}

/** When a NeetCode topic is finished, boost its concepts on CF/CSES for 5 days. */
function maybeBoostTopic(p: Problem, date: string) {
  if (!p.section) return;
  const items = db()
    .select({ p: schema.problems })
    .from(schema.trackItems)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.trackItems.problemId))
    .where(and(eq(schema.trackItems.trackId, "neetcode250"), eq(schema.problems.section, p.section)))
    .all();
  if (!items.length || items.some((i) => !i.p.solved)) return;
  const concepts = conceptsOf([p.id]).get(p.id) ?? [];
  for (const c of concepts) {
    db().insert(schema.topicBoosts).values({ conceptId: c, until: addDays(date, 5), reason: `Finished ${p.section}` })
      .onConflictDoUpdate({ target: schema.topicBoosts.conceptId, set: { until: addDays(date, 5), reason: `Finished ${p.section}` } }).run();
  }
}

export function addImage(attemptId: number, storageKey: string, caption?: string) {
  db().insert(schema.attemptImages).values({ attemptId, storageKey, caption: caption ?? null }).run();
}

export function imagesFor(attemptIds: number[]) {
  const out = new Map<number, string[]>();
  if (!attemptIds.length) return out;
  for (const i of db().select().from(schema.attemptImages).where(inArray(schema.attemptImages.attemptId, attemptIds)).all()) {
    out.set(i.attemptId, [...(out.get(i.attemptId) ?? []), `/api/uploads/${i.storageKey}`]);
  }
  return out;
}

export function trackProgress(trackId: string) {
  const r = db()
    .select({ total: sql<number>`count(*)`, solved: sql<number>`coalesce(sum(${schema.problems.solved}),0)` })
    .from(schema.trackItems)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.trackItems.problemId))
    .where(eq(schema.trackItems.trackId, trackId))
    .get()!;
  return { total: r.total, solved: r.solved };
}

export function dueReviewCount(date = today()) {
  return db().select({ n: sql<number>`count(*)` }).from(schema.reviews).where(and(eq(schema.reviews.status, "queued"), lte(schema.reviews.dueDate, date))).get()!.n;
}

/** Wipes all training history. Solves synced from your platform accounts stay solved. */
export function resetProgress() {
  const d = db();
  d.transaction(() => {
    for (const t of [schema.attemptImages, schema.attempts, schema.reviews, schema.conceptMastery, schema.topicBoosts, schema.dailyPlans, schema.upsolves, schema.sentNotifications]) d.delete(t).run();
    d.update(schema.problems).set({ solved: false, solvedAt: null, solvedSource: null }).where(eq(schema.problems.solvedSource, "app")).run();
    const cf = d.select().from(schema.accounts).where(eq(schema.accounts.platform, "codeforces")).get();
    const lo = cf?.rating ? Math.max(800, Math.floor(cf.rating / 100) * 100) : 800;
    d.update(schema.tracks).set({ windowLo: lo, windowChangedAt: cf?.rating ? Date.now() : null }).where(eq(schema.tracks.id, "codeforces")).run();
  });
  invalidatePersonal();
}

export { getProblems };
