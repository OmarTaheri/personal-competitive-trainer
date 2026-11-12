/**
 * Weak-topic detection. Each concept keeps a 0..1 mastery score updated with an
 * exponential moving average after every attempt that touches it.
 */

export const ALPHA = 0.3;
export const START_SCORE = 0.7;
export const WEAK_THRESHOLD = 0.6;
export const MIN_ATTEMPTS_FOR_WEAK = 3;
/** A topic also turns weak right away after this many struggles in a row. */
export const STRUGGLE_STREAK_WEAK = 2;

export type MasteryInput = {
  result: "solved" | "solved_help" | "gave_up";
  helpUsed: "none" | "hint" | "editorial";
  felt: number;
  timeRatio: number;
  slowedBy: string[];
};

export function attemptValue(a: MasteryInput): number {
  let v = a.result === "gave_up" || a.helpUsed === "editorial" ? 0 : a.result === "solved_help" || a.helpUsed === "hint" ? 0.5 : 1;
  if (a.felt >= 4) v -= 0.15;
  if (a.timeRatio > 1.5) v -= 0.1;
  if (a.slowedBy.includes("topic")) v -= 0.2;
  return Math.min(1, Math.max(0, v));
}

/** Needed help, gave up, or took more than 1.5x the expected time. */
export function isStruggle(a: Pick<MasteryInput, "result" | "helpUsed" | "timeRatio">): boolean {
  return a.result !== "solved" || a.helpUsed !== "none" || a.timeRatio > 1.5;
}

/**
 * `struggleStreak` = struggles in a row on this concept, including this attempt.
 * Weak = (score < 0.6 after 3+ attempts) OR (2+ struggles in a row) — the second rule
 * catches a weak topic before it has 3 attempts.
 */
export function updateScore(prev: { score: number; attempts: number } | null, a: MasteryInput, struggleStreak = 0) {
  const score0 = prev?.score ?? START_SCORE;
  const attempts = (prev?.attempts ?? 0) + 1;
  const score = score0 * (1 - ALPHA) + attemptValue(a) * ALPHA;
  return { score, attempts, weak: isWeak(score, attempts) || struggleStreak >= STRUGGLE_STREAK_WEAK };
}

export function isWeak(score: number, attempts: number): boolean {
  return attempts >= MIN_ATTEMPTS_FOR_WEAK && score < WEAK_THRESHOLD;
}

export type MasteryLevel = "strong" | "learning" | "weak" | "new";
export function level(score: number | undefined, attempts: number | undefined): MasteryLevel {
  if (!attempts) return "new";
  if (isWeak(score!, attempts)) return "weak";
  if (score! >= 0.8 && attempts >= 3) return "strong";
  return "learning";
}
