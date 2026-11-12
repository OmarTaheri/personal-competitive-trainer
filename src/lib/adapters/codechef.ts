import { markSolved, upsertProblem } from "@/lib/server/problems";
import { fetchData, RateLimiter } from "./http";
import type { ContestUpsert, PlatformAdapter } from "./types";

/** CodeChef has no stable public API: profile scraping is best effort; contests come from clist or their list endpoint. */
const limiter = new RateLimiter(1, 1500);

export const codechef: PlatformAdapter = {
  platform: "codechef",

  async fetchSolves(handle) {
    const html = await fetchData<string>(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, { text: true, limiter });
    const rating = Number(html.match(/class="rating-number"[^>]*>\s*(\d+)/)?.[1]) || null;
    const section = html.split(/Problems Solved/i)[1] ?? html;
    const codes = new Set<string>();
    for (const m of section.matchAll(/\/problems\/([A-Z0-9_]+)/g)) codes.add(m[1]);
    for (const code of codes) {
      upsertProblem({ platform: "codechef", externalId: code, title: code, url: `https://www.codechef.com/problems/${code}` });
    }
    const newlyMarked = markSolved("codechef", [...codes], "sync");
    return { solved: codes.size, newlyMarked, rating, note: codes.size ? undefined : "No solved problems found on the profile page (CodeChef may have changed its layout)." };
  },

  async fetchContests() {
    const d = await fetchData<{ future_contests?: { contest_code: string; contest_name: string; contest_start_date_iso: string; contest_duration: string }[] }>(
      "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all",
      { limiter },
    );
    return (d.future_contests ?? []).map<ContestUpsert>((c) => ({
      platform: "codechef",
      externalId: `https://codechef.com/${c.contest_code.toLowerCase()}`,
      name: c.contest_name,
      startUtc: Date.parse(c.contest_start_date_iso),
      durationSec: Number(c.contest_duration) * 60,
      url: `https://www.codechef.com/${c.contest_code}`,
    })).filter((c) => !Number.isNaN(c.startUtc));
  },
};
