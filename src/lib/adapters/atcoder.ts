import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { atcoderRating } from "@/lib/engine/rating";
import { markSolved, upsertProblem } from "@/lib/server/problems";
import { getSettings, tables } from "@/lib/server/settings";
import { fetchData, RateLimiter, sleep } from "./http";
import type { ContestUpsert, PlatformAdapter } from "./types";

/** Community AtCoder Problems API by kenkoooo. Be polite: ≥1 s between calls. */
const KK = "https://kenkoooo.com/atcoder";
const limiter = new RateLimiter(1, 1100);

type KProblem = { id: string; contest_id: string; problem_index: string; name: string; title: string };
type KModel = { difficulty?: number };
type KSub = { epoch_second: number; problem_id: string; contest_id: string; result: string };

export const isDuplicateContest = (contestId: string) => /^adt_/i.test(contestId);

export const atcoder: PlatformAdapter = {
  platform: "atcoder",

  async fetchProblems() {
    const [probs, models] = await Promise.all([
      fetchData<KProblem[]>(`${KK}/resources/problems.json`, { limiter, ttlMs: 24 * 3600e3, timeoutMs: 90000 }),
      fetchData<Record<string, KModel>>(`${KK}/resources/problem-models.json`, { limiter, ttlMs: 24 * 3600e3, timeoutMs: 90000 }),
    ]);
    const table = tables(getSettings()).atcoder;
    const db = getDb();
    let n = 0;
    db.transaction(() => {
      for (const p of probs) {
        const d = models[p.id]?.difficulty;
        if (d == null) continue;
        // AtCoder Daily Training ("adt_*") re-uses ABC problems: skip the duplicates.
        if (isDuplicateContest(p.contest_id)) continue;
        upsertProblem({
          platform: "atcoder",
          externalId: p.id,
          title: `${p.contest_id.toUpperCase()} ${p.problem_index}. ${p.name}`,
          url: `https://atcoder.jp/contests/${p.contest_id}/tasks/${p.id}`,
          rawDifficulty: String(Math.round(d)),
          normRating: atcoderRating(d, table),
          section: p.contest_id,
          contestId: p.contest_id,
          editorialUrl: `https://atcoder.jp/contests/${p.contest_id}/editorial`,
        });
        n++;
      }
    });
    return n;
  },

  async fetchSolves(handle) {
    const ac = new Set<string>();
    let from = 0;
    for (let i = 0; i < 200; i++) {
      const subs = await fetchData<KSub[]>(`${KK}/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${from}`, { limiter });
      for (const s of subs) if (s.result === "AC") ac.add(s.problem_id);
      if (subs.length < 500) break;
      from = subs[subs.length - 1].epoch_second + 1;
      await sleep(1000);
    }
    const newlyMarked = markSolved("atcoder", [...ac], "sync");
    return { solved: ac.size, newlyMarked };
  },

  /** Fallback when no clist key: scrape the upcoming table on atcoder.jp. */
  async fetchContests() {
    const html = await fetchData<string>("https://atcoder.jp/contests/?lang=en", { text: true, limiter });
    const upcoming = html.split('id="contest-table-upcoming"')[1]?.split("</table>")[0] ?? "";
    const out: ContestUpsert[] = [];
    const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(upcoming))) {
      const row = m[1];
      const time = row.match(/<time[^>]*>([^<]+)<\/time>/)?.[1];
      const link = row.match(/href="(\/contests\/[^"]+)">([^<]+)<\/a>/g)?.pop()?.match(/href="([^"]+)">([^<]+)</);
      const dur = row.match(/<td class="text-center">(\d+):(\d+)<\/td>/);
      if (!time || !link || !dur) continue;
      const start = Date.parse(time.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
      if (Number.isNaN(start)) continue;
      const url = `https://atcoder.jp${link[1]}`;
      out.push({ platform: "atcoder", externalId: url, name: link[2].trim(), startUtc: start, durationSec: (Number(dur[1]) * 60 + Number(dur[2])) * 60, url });
    }
    return out;
  },

  async fetchContestProblems(contest) {
    const cid = contest.url.match(/contests\/([^/?#]+)/)?.[1];
    if (!cid) return [];
    const db = getDb();
    const rows = db.select().from(schema.problems).where(and(eq(schema.problems.platform, "atcoder"), eq(schema.problems.contestId, cid))).all();
    return rows.map((p) => ({ problemId: p.id, solved: p.solved }));
  },
};
