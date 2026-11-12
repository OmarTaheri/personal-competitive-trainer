import { describe, it, expect } from "vitest";
import { firstGap, scheduleNew, scheduleResolve, type Outcome } from "./scheduler";
import { attemptValue, updateScore, isWeak, isStruggle } from "./mastery";
import { buildPlan, nextWindow, type Cand } from "./planner";
import { leetcodeRating, leetcodeHardness, expectedMinutes, atcoderRating, csesRating, personalMinutes, timeBand } from "./rating";

const o = (p: Partial<Outcome>): Outcome => ({ result: "solved", helpUsed: "none", felt: 2, timeRatio: 0.8, totalSec: 600, ...p });

describe("scheduler first gap", () => {
  it("follows the table", () => {
    expect(firstGap(o({ result: "gave_up" }))).toBe(1);
    expect(firstGap(o({ result: "solved_help", helpUsed: "editorial" }))).toBe(1);
    expect(firstGap(o({ result: "solved_help", helpUsed: "hint" }))).toBe(3);
    expect(firstGap(o({ felt: 4 }))).toBe(5);
    expect(firstGap(o({ felt: 2, timeRatio: 1.6 }))).toBe(5);
    expect(firstGap(o({ felt: 3 }))).toBe(10);
    expect(firstGap(o({ felt: 1, timeRatio: 0.9 }))).toBe(30);
  });
  it("weak concepts shrink the gap", () => {
    expect(scheduleNew(o({ felt: 3 }), { weak: true }).gapDays).toBe(7);
  });
  it("jitter stays within ±10%", () => {
    for (const r of [0, 0.5, 0.999]) {
      const g = scheduleNew(o({ felt: 3 }), { rng: () => r }).gapDays;
      expect(g).toBeGreaterThanOrEqual(9);
      expect(g).toBeLessThanOrEqual(11);
    }
  });
});

describe("scheduler re-solves", () => {
  const prev = { gapDays: 10, cleanStreak: 0, lastTimeSec: 900, reps: 0 };
  it("faster and alone → ×2.5", () => expect(scheduleResolve(prev, o({ totalSec: 600 })).gapDays).toBe(25));
  it("slower → ×1.2", () => expect(scheduleResolve(prev, o({ totalSec: 1200 })).gapDays).toBe(12));
  it("with help → ×1.2", () => expect(scheduleResolve(prev, o({ result: "solved_help", helpUsed: "hint" })).gapDays).toBe(12));
  it("fail → 1 day", () => expect(scheduleResolve(prev, o({ result: "gave_up" })).gapDays).toBe(1));
  it("retires after two clean re-solves after 30+ day gaps", () => {
    const a = scheduleResolve({ gapDays: 30, cleanStreak: 0, lastTimeSec: 900, reps: 1 }, o({ totalSec: 600 }));
    expect(a.cleanStreak).toBe(1);
    expect(a.retired).toBe(false);
    const b = scheduleResolve(a, o({ totalSec: 500 }));
    expect(b.retired).toBe(true);
  });
  it("clean re-solve on a short gap does not count toward retirement", () => {
    expect(scheduleResolve(prev, o({ totalSec: 600 })).cleanStreak).toBe(0);
  });
});

describe("mastery", () => {
  it("values attempts", () => {
    expect(attemptValue({ result: "solved", helpUsed: "none", felt: 2, timeRatio: 1, slowedBy: [] })).toBe(1);
    expect(attemptValue({ result: "gave_up", helpUsed: "none", felt: 5, timeRatio: 2, slowedBy: ["topic"] })).toBe(0);
  });
  it("becomes weak after repeated struggles", () => {
    let s: { score: number; attempts: number } | null = null;
    for (let i = 0; i < 3; i++) s = updateScore(s, { result: "solved_help", helpUsed: "hint", felt: 4, timeRatio: 1, slowedBy: [] });
    expect(isWeak(s!.score, s!.attempts)).toBe(true);
  });
  it("needs 3 attempts before weak", () => {
    const s = updateScore(null, { result: "gave_up", helpUsed: "none", felt: 5, timeRatio: 2, slowedBy: [] });
    expect(s.weak).toBe(false);
  });
});

const c = (id: number, concepts: string[] = [], m = 20): Cand => ({ problemId: id, concepts, expectedMin: m });

describe("weak after a struggle streak", () => {
  const bad = { result: "solved_help" as const, helpUsed: "hint" as const, felt: 4, timeRatio: 1.2, slowedBy: [] };
  it("2 struggles in a row flag the topic even with < 3 attempts", () => {
    expect(isStruggle(bad)).toBe(true);
    expect(isStruggle({ result: "solved", helpUsed: "none", timeRatio: 1.6 })).toBe(true);
    expect(isStruggle({ result: "solved", helpUsed: "none", timeRatio: 0.9 })).toBe(false);
    expect(updateScore(null, bad, 1).weak).toBe(false);
    expect(updateScore({ score: 0.7, attempts: 1 }, bad, 2).weak).toBe(true);
  });
});

describe("planner", () => {
  const base = {
    goalMin: 100, doneMin: 0, shares: { neetcode: 60, codeforces: 25, cses: 15 }, dueReviews: [], resolveCap: 3,
    neetcode: [c(1, ["hashing"]), c(2, ["hashing"]), c(3, ["hashing"]), c(4, ["dp-1d"]), c(5, ["hashing"])],
    codeforces: [c(101, ["greedy"], 40)], cses: [c(201, ["sorting"], 15)], upsolves: [], weakConcepts: [], boostConcepts: [], weakEvery: 3, rng: () => 0,
  };
  it("takes NeetCode in list order", () => {
    const p = buildPlan(base);
    expect(p.items.filter((i) => i.trackId === "neetcode250").map((i) => i.problemId)).toEqual([1, 2, 3]);
  });
  it("every 3rd NeetCode slot goes to the weakest concept", () => {
    const p = buildPlan({ ...base, weakConcepts: ["dp-1d"] });
    expect(p.items.filter((i) => i.trackId === "neetcode250").map((i) => i.problemId)).toEqual([1, 2, 4]);
  });
  it("after a struggle the next NeetCode slot reinforces that concept from the list", () => {
    const p = buildPlan({ ...base, focus: ["dp-1d"] });
    expect(p.items.filter((i) => i.trackId === "neetcode250").map((i) => i.problemId)).toEqual([4, 1, 2]);
  });
  it("focus concept with nothing left in the list falls back to list order", () => {
    const p = buildPlan({ ...base, focus: ["graphs"] });
    expect(p.items.filter((i) => i.trackId === "neetcode250").map((i) => i.problemId)).toEqual([1, 2, 3]);
  });
  it("on a roll the next slot jumps to the next Medium/Hard in the list", () => {
    const nc = [{ ...c(1), difficulty: "Easy" }, { ...c(2), difficulty: "Easy" }, { ...c(3), difficulty: "Medium" }, { ...c(4), difficulty: "Easy" }];
    const p = buildPlan({ ...base, neetcode: nc, momentum: 2 });
    expect(p.items.filter((i) => i.trackId === "neetcode250")[0].problemId).toBe(3);
  });
  it("caps re-solves and reports overflow", () => {
    const due = [1, 2, 3, 4].map((i) => ({ ...c(300 + i), trackId: "neetcode250" }));
    const p = buildPlan({ ...base, dueReviews: due });
    expect(p.items.filter((i) => i.kind === "review").length).toBe(3);
    expect(p.overflowReviews).toBe(1);
    expect(p.items[0].kind).toBe("review");
    expect(p.items[1].kind).toBe("new");
  });
  it("moves NeetCode share to Codeforces when the list is done", () => {
    const p = buildPlan({ ...base, neetcode: [], codeforces: [c(101, [], 40), c(102, [], 40), c(103, [], 40)] });
    expect(p.items.filter((i) => i.trackId === "codeforces").length).toBe(3);
  });
  it("no new problems when goal already met", () => {
    expect(buildPlan({ ...base, doneMin: 120 }).items.length).toBe(0);
  });
  it("CF window moves", () => {
    const ok = (n: number) => Array.from({ length: 10 }, (_, i) => ({ solvedNoEditorial: i < n }));
    expect(nextWindow(800, ok(7))).toBe(900);
    expect(nextWindow(1000, ok(3))).toBe(900);
    expect(nextWindow(800, ok(3))).toBe(800);
    expect(nextWindow(1000, ok(5))).toBe(1000);
    expect(nextWindow(1000, ok(9).slice(0, 9))).toBe(1000);
  });
});

describe("rating", () => {
  it("LeetCode bands", () => {
    expect(leetcodeRating("Easy", 90)).toBe(800);
    expect(leetcodeRating("Medium", 25)).toBe(1700);
    expect(leetcodeRating("Hard")).toBeGreaterThanOrEqual(1800);
    expect(leetcodeRating("Medium", 50, 0)).toBe(1200);
    expect(leetcodeRating("Medium", 50, 0.5)).toBe(1450);
    expect(leetcodeRating("Easy", 50, 1)).toBe(1100);
  });
  it("LeetCode hardness spreads evenly within a difficulty", () => {
    const h = leetcodeHardness([
      { id: 1, difficulty: "Easy", acRate: 90 }, { id: 2, difficulty: "Easy", acRate: 70 }, { id: 3, difficulty: "Easy", acRate: 50 },
      { id: 4, difficulty: "Hard", acRate: 30 },
    ]);
    expect(h.get(1)).toBe(0);
    expect(h.get(2)).toBe(0.5);
    expect(h.get(3)).toBe(1);
    expect(h.get(4)).toBe(0.5);
  });
  it("expected minutes", () => {
    expect(expectedMinutes("leetcode", "Medium", 1500)).toBe(40);
    expect(expectedMinutes("codeforces", null, 800)).toBe(20);
    expect(expectedMinutes("codeforces", null, 1200)).toBe(30);
    expect(expectedMinutes("codeforces", null, 1800)).toBe(55);
    expect(expectedMinutes("codeforces", null, 200)).toBe(20);
  });
  it("your own times take over after 5 samples (median)", () => {
    expect(personalMinutes([10, 12, 14, 30])).toBeNull();
    expect(personalMinutes([10, 12, 14, 30, 90])).toBe(14);
    expect(personalMinutes([1, 1, 2, 2, 2, 3])).toBe(5);
    expect(timeBand("codeforces", null, 1250)).toBe("1200-1399");
    expect(timeBand("cses", null, 1399)).toBe("1200-1399");
    expect(timeBand("leetcode", "Hard", 2100)).toBe("LeetCode Hard");
  });
  it("AtCoder + CSES map onto CF scale", () => {
    expect(atcoderRating(-500)).toBeGreaterThanOrEqual(800);
    expect(csesRating("Introductory Problems", 0, 24)).toBe(800);
    expect(csesRating("Introductory Problems", 23, 24)).toBe(1600);
    expect(atcoderRating(1000)).toBeGreaterThanOrEqual(1350); // ~ABC D
    expect(atcoderRating(1000)).toBeLessThanOrEqual(1500);
  });
});
