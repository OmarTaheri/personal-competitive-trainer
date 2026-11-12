/**
 * Re-solve scheduling (spaced repetition).
 *
 * First gap after a new problem:
 *   gave up / read the full solution ......... 1 day
 *   solved with help ......................... 3 days
 *   alone, felt 4–5 or > 1.5× expected time .. 5 days
 *   alone, felt 3 ............................ 10 days
 *   alone, felt 1–2 and under expected time .. 30 days
 *
 * After each re-solve:
 *   alone and faster than last time → gap × 2.5
 *   solved but slower, or with help → gap × 1.2
 *   failed                          → back to 1 day
 *
 * Extras that make concepts stick: weak concept → gap × 0.7, ±10% jitter so
 * re-solves spread out. Retired after 2 clean re-solves done after a 30+ day gap.
 */

export type Outcome = {
  result: "solved" | "solved_help" | "gave_up";
  helpUsed: "none" | "hint" | "editorial";
  felt: number; // 1..5
  timeRatio: number; // total time / expected time
  totalSec: number;
};

export type ReviewState = {
  gapDays: number;
  cleanStreak: number;
  lastTimeSec: number | null;
  reps: number;
};

export type ScheduleOpts = { weak?: boolean; rng?: () => number };

export const WEAK_FACTOR = 0.7;
export const JITTER = 0.1;
export const RETIRE_GAP = 30;
export const RETIRE_STREAK = 2;

export function isClean(o: Outcome): boolean {
  return o.result === "solved" && o.helpUsed === "none";
}

export function failed(o: Outcome): boolean {
  return o.result === "gave_up" || o.helpUsed === "editorial";
}

export function firstGap(o: Outcome): number {
  if (failed(o)) return 1;
  if (o.result === "solved_help" || o.helpUsed === "hint") return 3;
  if (o.felt >= 4 || o.timeRatio > 1.5) return 5;
  if (o.felt === 3) return 10;
  if (o.timeRatio <= 1) return 30;
  return 10; // felt 1–2 but a bit slower than expected
}

function finalize(gap: number, opts: ScheduleOpts, base: number): number {
  let g = gap;
  if (opts.weak && g > 1) g *= WEAK_FACTOR;
  if (opts.rng && g > 2) g *= 1 + (opts.rng() * 2 - 1) * JITTER;
  return Math.max(1, Math.round(g * 10) / 10 || base);
}

export function scheduleNew(o: Outcome, opts: ScheduleOpts = {}): ReviewState & { dueInDays: number } {
  const gap = finalize(firstGap(o), opts, 1);
  return { gapDays: gap, cleanStreak: 0, lastTimeSec: o.totalSec, reps: 0, dueInDays: Math.max(1, Math.round(gap)) };
}

/**
 * Called when a re-solve finishes. `elapsedGap` is the gap that was scheduled before this
 * re-solve (used for the retire rule).
 */
export function scheduleResolve(prev: ReviewState, o: Outcome, opts: ScheduleOpts = {}): ReviewState & { dueInDays: number; retired: boolean } {
  let gap: number;
  let clean = prev.cleanStreak;
  if (failed(o)) {
    gap = 1;
    clean = 0;
  } else if (isClean(o) && (prev.lastTimeSec == null || o.totalSec < prev.lastTimeSec)) {
    gap = prev.gapDays * 2.5;
  } else {
    gap = prev.gapDays * 1.2;
  }
  if (isClean(o)) {
    if (prev.gapDays >= RETIRE_GAP * (1 - JITTER)) clean += 1; // jitter-tolerant
  } else {
    clean = 0;
  }
  const retired = clean >= RETIRE_STREAK;
  const g = failed(o) ? 1 : finalize(gap, opts, 1);
  return { gapDays: g, cleanStreak: clean, lastTimeSec: o.totalSec, reps: prev.reps + 1, dueInDays: Math.max(1, Math.round(g)), retired };
}
