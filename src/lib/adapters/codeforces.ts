import { getDb } from "@/db";
import { conceptsForTags } from "@/lib/concepts";
import { addConcepts, markSolved, upsertProblem } from "@/lib/server/problems";
import { fetchData, RateLimiter } from "./http";
import type { ContestUpsert, PlatformAdapter } from "./types";

const API = "https://codeforces.com/api";
const limiter = new RateLimiter(1, 2100); // CF asks for at most 1 call / 2 s

type CfResp<T> = { status: "OK" | "FAILED"; comment?: string; result: T };

async function call<T>(method: string, params: Record<string, string> = {}, ttlMs?: number): Promise<T> {
  const q = new URLSearchParams(params).toString();
  const r = await fetchData<CfResp<T>>(`${API}/${method}${q ? "?" + q : ""}`, { limiter, ttlMs, timeoutMs: 60000 });
  if (r.status !== "OK") throw new Error(`Codeforces ${method}: ${r.comment}`);
  return r.result;
}

type CfProblem = { contestId?: number; index: string; name: string; rating?: number; tags: string[] };

export const problemUrl = (contestId: number | string, index: string) => `https://codeforces.com/problemset/problem/${contestId}/${index}`;

export const codeforces: PlatformAdapter = {
  platform: "codeforces",

  async fetchProblems() {
    const res = await call<{ problems: CfProblem[]; problemStatistics: { contestId: number; index: string; solvedCount: number }[] }>("problemset.problems", {}, 6 * 3600e3);
    const solvedCount = new Map(res.problemStatistics.map((s) => [`${s.contestId}${s.index}`, s.solvedCount]));
    const db = getDb();
    let n = 0;
    db.transaction(() => {
      for (const p of res.problems) {
        if (!p.contestId || !p.rating) continue;
        const ext = `${p.contestId}${p.index}`;
        const id = upsertProblem({
          platform: "codeforces",
          externalId: ext,
          title: `${ext}. ${p.name}`,
          url: problemUrl(p.contestId, p.index),
          rawDifficulty: String(p.rating),
          normRating: p.rating,
          tags: p.tags,
          section: `Contest ${p.contestId}`,
          contestId: String(p.contestId),
          solveCount: solvedCount.get(ext) ?? null,
          editorialUrl: `https://codeforces.com/contest/${p.contestId}`,
        });
        addConcepts(id, conceptsForTags(p.tags));
        n++;
      }
    });
    return n;
  },

  async fetchSolves(handle) {
    const subs = await call<{ problem: CfProblem; verdict?: string }[]>("user.status", { handle });
    const ok = [...new Set(subs.filter((s) => s.verdict === "OK" && s.problem.contestId).map((s) => `${s.problem.contestId}${s.problem.index}`))];
    const newlyMarked = markSolved("codeforces", ok, "sync");
    let rating: number | null = null;
    try {
      const info = await call<{ rating?: number }[]>("user.info", { handles: handle });
      rating = info[0]?.rating ?? null;
    } catch { /* unrated */ }
    return { solved: ok.length, newlyMarked, rating };
  },

  async fetchContests() {
    const list = await call<{ id: number; name: string; phase: string; durationSeconds: number; startTimeSeconds?: number }[]>("contest.list", { gym: "false" });
    return list
      .filter((c) => c.phase === "BEFORE" && c.startTimeSeconds)
      .map<ContestUpsert>((c) => ({
        platform: "codeforces",
        externalId: `https://codeforces.com/contests/${c.id}`,
        name: c.name,
        startUtc: c.startTimeSeconds! * 1000,
        durationSec: c.durationSeconds,
        url: `https://codeforces.com/contests/${c.id}`,
      }));
  },

  async fetchContestProblems(contest, handle) {
    const id = contest.url.match(/contests?\/(\d+)/)?.[1];
    if (!id) return [];
    const params: Record<string, string> = { contestId: id, showUnofficial: "true" };
    if (handle) params.handles = handle;
    const st = await call<{ problems: CfProblem[]; rows: { problemResults: { points: number }[] }[] }>("contest.standings", params);
    return st.problems.map((p, i) => {
      const ext = `${id}${p.index}`;
      const pid = upsertProblem({
        platform: "codeforces", externalId: ext, title: `${ext}. ${p.name}`, url: problemUrl(id, p.index),
        rawDifficulty: p.rating ? String(p.rating) : null, normRating: p.rating ?? null, tags: p.tags, contestId: id,
      });
      addConcepts(pid, conceptsForTags(p.tags));
      const solved = st.rows.some((r) => (r.problemResults[i]?.points ?? 0) > 0);
      return { problemId: pid, solved };
    });
  },
};
