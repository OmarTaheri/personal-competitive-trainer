import type { Attempt, Problem } from "@/db/schema";
import { CONCEPT_BY_ID } from "@/lib/concepts";
import { TRACK_LABEL } from "@/lib/ui";
import { leetcodeHints } from "@/lib/adapters/leetcode";
import { conceptsOf, getProblem, getProblems } from "./problems";
import { getSettings, today } from "./settings";
import { activeAttempt, expectedFor, getPlan, imagesFor, minutesOn, nextPlanItem, revealFor, type Reveal } from "./training";

export type ProblemView = {
  id: number;
  title: string;
  url: string;
  platform: string;
  difficulty: string | null;
  rating: number | null;
  track: string;
  tags: string[] | null; // null = hidden (Codeforces blind mode)
  expectedMin: number;
};

/** One row of "Today's suggestions". Re-solves look exactly like new problems. */
export type Suggestion = { id: number; title: string; platform: string; difficulty: string | null; rating: number | null; track: string; expectedMin: number; state: "done" | "current" | "next" | "later" };

export type TrainView = {
  settings: { hintDelayMin: number; editorialDelayMin: number; idlePauseMin: number; showCfTags: boolean };
  attempt: Pick<Attempt, "id" | "status" | "phase" | "thinkSec" | "stuckSec" | "codeSec" | "phaseStartedAt" | "helpUsed" | "result" | "startedAt"> | null;
  problem: ProblemView | null;
  queue: { left: number; total: number; doneMin: number; goalMin: number };
  suggestions: Suggestion[];
  reveal: Reveal;
  images: string[];
  serverNow: number;
};

/** Track label that never gives a re-solve away: reviews are labelled like a normal pick from that platform. */
export function blindTrack(trackId: string | null, p: Pick<Problem, "platform" | "section">): string {
  if (trackId && trackId !== "review" && trackId !== "manual") return TRACK_LABEL[trackId] ?? trackId;
  if (trackId === "manual") return TRACK_LABEL.manual;
  if (p.platform === "leetcode") return p.section ? TRACK_LABEL.neetcode250 : TRACK_LABEL.manual;
  if (p.platform === "codeforces") return TRACK_LABEL.codeforces;
  if (p.platform === "cses") return TRACK_LABEL.cses;
  return TRACK_LABEL.manual;
}

export function problemView(p: Problem, trackId: string | null): ProblemView {
  const s = getSettings();
  const blind = p.platform === "codeforces" && !s.showCfTags;
  const concepts = (conceptsOf([p.id]).get(p.id) ?? []).map((c) => CONCEPT_BY_ID.get(c)?.name ?? c);
  const tags = p.platform === "leetcode" && p.section ? [p.section] : p.tags.length ? p.tags : concepts;
  return {
    id: p.id,
    title: p.title,
    url: p.url,
    platform: p.platform,
    difficulty: p.platform === "leetcode" ? p.rawDifficulty : null,
    rating: p.normRating,
    // Re-solves show their original track: nothing hints that you did this before.
    track: blindTrack(trackId, p),
    tags: blind ? null : tags,
    expectedMin: expectedFor(p),
  };
}

export function trainView(): TrainView {
  const s = getSettings();
  const date = today(s);
  const plan = getPlan(date);
  const a = activeAttempt();
  let problem: ProblemView | null = null;
  if (a) {
    const p = getProblem(a.problemId);
    if (p) problem = problemView(p, a.trackId);
  } else {
    const item = nextPlanItem(date);
    if (item) {
      const p = getProblem(item.problemId);
      if (p) problem = problemView(p, item.trackId);
    }
  }
  const fresh = getPlan(date);
  const items = fresh.queue.filter((i) => !i.skipped);
  const probs = getProblems(items.map((i) => i.problemId));
  let nextMarked = !!a;
  const suggestions: Suggestion[] = items.flatMap((i) => {
    const x = probs.get(i.problemId);
    if (!x) return [];
    let state: Suggestion["state"] = "later";
    if (i.done) state = "done";
    else if (a && a.problemId === i.problemId) state = "current";
    else if (!nextMarked && !i.done) { state = problem?.id === i.problemId ? "current" : "next"; nextMarked = true; }
    return [{ id: x.id, title: x.title, platform: x.platform, difficulty: x.platform === "leetcode" ? x.rawDifficulty : null, rating: x.normRating, track: blindTrack(i.trackId, x), expectedMin: i.expectedMin, state }];
  });
  return {
    settings: { hintDelayMin: s.hintDelayMin, editorialDelayMin: s.editorialDelayMin, idlePauseMin: s.idlePauseMin, showCfTags: s.showCfTags },
    attempt: a ? { id: a.id, status: a.status, phase: a.phase, thinkSec: a.thinkSec, stuckSec: a.stuckSec, codeSec: a.codeSec, phaseStartedAt: a.phaseStartedAt, helpUsed: a.helpUsed, result: a.result, startedAt: a.startedAt } : null,
    problem,
    queue: { left: fresh.queue.filter((i) => !i.done && !i.skipped).length, total: fresh.queue.length, doneMin: Math.round(minutesOn(date)), goalMin: plan.goalMin },
    suggestions,
    reveal: a && a.status === "feedback" ? revealFor(a) : null,
    images: a ? imagesFor([a.id]).get(a.id) ?? [] : [],
    serverNow: Date.now(),
  };
}

export type HelpContent = { kind: "hint" | "editorial"; hints: string[]; links: { label: string; url: string }[] };

export async function helpContent(problemId: number, level: "hint" | "editorial"): Promise<HelpContent> {
  const p = getProblem(problemId)!;
  const concepts = (conceptsOf([p.id]).get(p.id) ?? []).map((c) => CONCEPT_BY_ID.get(c)?.name ?? c);
  const q = encodeURIComponent(`${p.platform} ${p.title} editorial`);
  if (level === "hint") {
    const hints: string[] = [];
    if (p.platform === "leetcode") {
      try {
        const h = await leetcodeHints(p.externalId);
        hints.push(...h.hints.map((x) => x.replace(/<[^>]+>/g, "")));
      } catch { /* offline */ }
    }
    const topicLine = [p.section && p.platform === "leetcode" ? p.section : null, ...(p.platform === "codeforces" ? p.tags : concepts)].filter(Boolean).join(", ");
    if (topicLine) hints.push(`Topic: ${topicLine}`);
    if (!hints.length) hints.push("Try a tiny example by hand and look for what stays invariant.");
    return { kind: "hint", hints, links: [] };
  }
  const links: { label: string; url: string }[] = [];
  if (p.videoUrl) links.push({ label: "NeetCode video", url: p.videoUrl });
  if (p.platform === "leetcode") links.push({ label: "LeetCode editorial", url: p.editorialUrl ?? `https://leetcode.com/problems/${p.externalId}/editorial/` }, { label: "Solutions tab", url: `https://leetcode.com/problems/${p.externalId}/solutions/` });
  if (p.platform === "codeforces") links.push({ label: "Contest page (tutorial in sidebar)", url: `https://codeforces.com/contest/${p.contestId}` });
  if (p.platform === "atcoder") links.push({ label: "AtCoder editorial", url: p.editorialUrl ?? p.url });
  if (p.platform === "cses") links.push({ label: "USACO Guide search", url: `https://www.google.com/search?q=${encodeURIComponent(`CSES ${p.title} solution usaco guide`)}` });
  links.push({ label: "Search editorial", url: `https://www.google.com/search?q=${q}` });
  return { kind: "editorial", hints: [], links };
}
