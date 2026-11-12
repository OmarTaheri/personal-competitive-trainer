import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { conceptsForTags } from "@/lib/concepts";
import { leetcodeRating } from "@/lib/engine/rating";
import { addConcepts, markSolved, upsertProblem } from "@/lib/server/problems";
import { getSettings } from "@/lib/server/settings";
import { fetchData, RateLimiter } from "./http";
import type { ContestUpsert, PlatformAdapter } from "./types";

/**
 * LeetCode has no official public API. This uses the unofficial GraphQL endpoint,
 * rate-limited to 20 requests / 10 s and cached. Only your own data is fetched.
 */
const GQL = "https://leetcode.com/graphql";
const limiter = new RateLimiter(20, 10_000);

function authHeaders(): Record<string, string> {
  const s = getSettings();
  if (!s.leetcodeSession) return {};
  const cookie = [`LEETCODE_SESSION=${s.leetcodeSession.trim()}`, s.leetcodeCsrf ? `csrftoken=${s.leetcodeCsrf.trim()}` : ""].filter(Boolean).join("; ");
  return { cookie, ...(s.leetcodeCsrf ? { "x-csrftoken": s.leetcodeCsrf.trim() } : {}) };
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}, opts: { auth?: boolean; ttlMs?: number } = {}): Promise<T> {
  const r = await fetchData<{ data: T; errors?: { message: string }[] }>(GQL, {
    method: "POST",
    headers: { "content-type": "application/json", referer: "https://leetcode.com/", origin: "https://leetcode.com", ...(opts.auth ? authHeaders() : {}) },
    body: JSON.stringify({ query, variables }),
    limiter,
    ttlMs: opts.ttlMs,
  });
  if (r.errors?.length && !r.data) throw new Error("LeetCode: " + r.errors.map((e) => e.message).join("; "));
  return r.data;
}

const LIST_Q = `query list($skip:Int,$limit:Int){ problemsetQuestionList: questionList(categorySlug:"", limit:$limit, skip:$skip, filters:{}) {
  total: totalNum questions: data { acRate difficulty frontendQuestionId: questionFrontendId isPaidOnly title titleSlug status topicTags { name slug } } } }`;

type LcQ = { acRate: number; difficulty: string; frontendQuestionId: string; isPaidOnly: boolean; title: string; titleSlug: string; status: string | null; topicTags: { name: string; slug: string }[] };

async function allQuestions(auth: boolean): Promise<LcQ[]> {
  const out: LcQ[] = [];
  const page = 100;
  let total = Infinity;
  for (let skip = 0; skip < total; skip += page) {
    const d = await gql<{ problemsetQuestionList: { total: number; questions: LcQ[] } }>(LIST_Q, { skip, limit: page }, { auth, ttlMs: auth ? undefined : 6 * 3600e3 });
    total = d.problemsetQuestionList.total;
    out.push(...d.problemsetQuestionList.questions);
    if (!d.problemsetQuestionList.questions.length) break;
  }
  return out;
}

export async function leetcodeHints(slug: string): Promise<{ hints: string[]; tags: string[] }> {
  const d = await gql<{ question: { hints: string[]; topicTags: { name: string }[] } | null }>(
    `query q($s:String!){ question(titleSlug:$s){ hints topicTags { name } } }`, { s: slug }, { ttlMs: 7 * 86400e3 },
  );
  return { hints: d.question?.hints ?? [], tags: d.question?.topicTags.map((t) => t.name) ?? [] };
}

export const leetcode: PlatformAdapter = {
  platform: "leetcode",

  async fetchProblems() {
    const qs = await allQuestions(false);
    const db = getDb();
    db.transaction(() => {
      for (const q of qs) {
        const tags = q.topicTags.map((t) => t.name);
        const id = upsertProblem({
          platform: "leetcode",
          externalId: q.titleSlug,
          title: q.title,
          url: `https://leetcode.com/problems/${q.titleSlug}/`,
          rawDifficulty: q.difficulty,
          normRating: leetcodeRating(q.difficulty, q.acRate),
          tags,
          acRate: q.acRate,
          paidOnly: q.isPaidOnly,
          editorialUrl: `https://leetcode.com/problems/${q.titleSlug}/editorial/`,
        });
        // NeetCode problems keep their topic concept; others get tag-derived concepts.
        const has = db.select({ n: sql<number>`count(*)` }).from(schema.problemConcepts).where(eq(schema.problemConcepts.problemId, id)).get()!.n;
        if (!has) addConcepts(id, conceptsForTags(tags));
      }
    });
    return qs.length;
  },

  async fetchSolves(username) {
    const s = getSettings();
    const slugs = new Set<string>();
    let note = "";
    const d = await gql<{ recentAcSubmissionList: { titleSlug: string }[] | null; matchedUser: { username: string } | null; userContestRanking: { rating: number } | null }>(
      `query u($u:String!){ recentAcSubmissionList(username:$u, limit:20){ titleSlug } matchedUser(username:$u){ username } userContestRanking(username:$u){ rating } }`,
      { u: username },
    );
    if (!d.matchedUser) throw new Error(`LeetCode user "${username}" not found`);
    for (const r of d.recentAcSubmissionList ?? []) slugs.add(r.titleSlug);
    if (s.leetcodeSession) {
      try {
        const qs = await allQuestions(true);
        const ac = qs.filter((q) => q.status === "ac");
        if (!qs.some((q) => q.status)) note = "Session cookie did not return solved status (expired?). Used the last 20 public solves.";
        for (const q of ac) slugs.add(q.titleSlug);
      } catch (e) {
        note = `Full history failed (${(e as Error).message}); used last 20 public solves.`;
      }
    } else {
      note = "Only the last 20 accepted problems are public. Add your session cookie in Settings for full history.";
    }
    const newlyMarked = markSolved("leetcode", [...slugs], "sync");
    return { solved: slugs.size, newlyMarked, rating: d.userContestRanking ? Math.round(d.userContestRanking.rating) : null, note };
  },

  async fetchContests() {
    const d = await gql<{ upcomingContests: { title: string; titleSlug: string; startTime: number; duration: number }[] }>(`{ upcomingContests { title titleSlug startTime duration } }`);
    return d.upcomingContests.map<ContestUpsert>((c) => ({
      platform: "leetcode",
      externalId: `https://leetcode.com/contest/${c.titleSlug}`,
      name: c.title,
      startUtc: c.startTime * 1000,
      durationSec: c.duration,
      url: `https://leetcode.com/contest/${c.titleSlug}`,
    }));
  },

  async fetchContestProblems(contest) {
    const slug = contest.url.match(/contest\/([^/?#]+)/)?.[1];
    if (!slug) return [];
    const info = await fetchData<{ questions: { title: string; title_slug: string }[] }>(`https://leetcode.com/contest/api/info/${slug}/`, { limiter, headers: { referer: "https://leetcode.com/" } });
    const db = getDb();
    return info.questions.map((q) => {
      const existing = db.select().from(schema.problems).where(sql`${schema.problems.platform}='leetcode' and ${schema.problems.externalId}=${q.title_slug}`).get();
      const id = existing?.id ?? upsertProblem({ platform: "leetcode", externalId: q.title_slug, title: q.title, url: `https://leetcode.com/problems/${q.title_slug}/`, rawDifficulty: "Medium", normRating: leetcodeRating("Medium") });
      return { problemId: id, solved: !!existing?.solved };
    });
  },
};
