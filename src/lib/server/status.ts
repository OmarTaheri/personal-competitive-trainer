import { getProblem } from "./problems";
import { getSettings, today } from "./settings";
import { activeAttempt, attemptSeconds, goalFor, levelFromXp, minutesOn, streak, xpTotal, getPlan } from "./training";
import { upcomingContests } from "./sync";
import { ensureSeeded } from "./seed";

export type Status = {
  date: string;
  timezone: string;
  minutesToday: number;
  goalMin: number;
  streak: number;
  xp: number;
  level: { level: number; cur: number; need: number };
  nextContest: { name: string; platform: string; startUtc: number; durationSec: number; url: string } | null;
  active: { id: number; title: string; url: string; phase: string; status: string; baseSec: number; phaseStartedAt: number | null } | null;
  queueLeft: number;
};

export function getStatus(): Status {
  ensureSeeded();
  const s = getSettings();
  const date = today(s);
  const xp = xpTotal();
  const a = activeAttempt();
  let active: Status["active"] = null;
  if (a) {
    const p = getProblem(a.problemId);
    active = {
      id: a.id, title: p?.title ?? "?", url: p?.url ?? "#", phase: a.phase, status: a.status,
      baseSec: a.thinkSec + a.stuckSec + a.codeSec,
      phaseStartedAt: a.status === "active" && a.phase !== "paused" ? a.phaseStartedAt : null,
    };
  }
  const now = Date.now();
  const next = upcomingContests(5, now).find((c) => c.startUtc > now) ?? null;
  const plan = getPlan(date);
  return {
    date,
    timezone: s.timezone,
    // Excludes the running segment of the active attempt; the client adds it live.
    minutesToday: minutesOn(date) - (active?.phaseStartedAt ? Math.max(0, (now - active.phaseStartedAt) / 60000) : 0),
    goalMin: goalFor(date),
    streak: streak(),
    xp,
    level: levelFromXp(xp),
    nextContest: next && { name: next.name, platform: next.platform, startUtc: next.startUtc, durationSec: next.durationSec, url: next.url },
    active,
    queueLeft: plan.queue.filter((i) => !i.done && !i.skipped).length,
  };
}

export { attemptSeconds };
