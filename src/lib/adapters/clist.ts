import { getSettings } from "@/lib/server/settings";
import { fetchData } from "./http";
import type { ContestUpsert } from "./types";

/** clist.by: one contest feed for every platform. Needs a free account + API key. */
const HOSTS: Record<string, string> = {
  "codeforces.com": "codeforces",
  "leetcode.com": "leetcode",
  "atcoder.jp": "atcoder",
  "codechef.com": "codechef",
};

type ClistContest = { id: number; event: string; host: string; start: string; end: string; duration: number; href: string };

export function clistConfigured() {
  const s = getSettings();
  return !!(s.clistUsername && s.clistKey);
}

export async function fetchClistContests(): Promise<ContestUpsert[]> {
  const s = getSettings();
  if (!s.clistUsername || !s.clistKey) throw new Error("clist.by username/API key not set");
  const start = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 19);
  const params = new URLSearchParams({
    format: "json",
    order_by: "start",
    limit: "300",
    end__gt: start,
    host__regex: Object.keys(HOSTS).map((h) => h.replace(".", "\\.")).join("|"),
  });
  const d = await fetchData<{ objects: ClistContest[] }>(`https://clist.by/api/v4/contest/?${params}`, {
    headers: { authorization: `ApiKey ${s.clistUsername.trim()}:${s.clistKey.trim()}` },
  });
  return d.objects
    .filter((c) => HOSTS[c.host])
    .map((c) => ({
      platform: HOSTS[c.host],
      externalId: c.href,
      name: c.event,
      startUtc: Date.parse(c.start.endsWith("Z") ? c.start : c.start + "Z"),
      durationSec: c.duration,
      url: c.href,
    }));
}
