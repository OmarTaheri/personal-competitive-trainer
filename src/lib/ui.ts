export const PLATFORM_META: Record<string, { label: string; color: string; short: string }> = {
  codeforces: { label: "Codeforces", color: "#ff7a1a", short: "CF" },
  leetcode: { label: "LeetCode", color: "#f5b301", short: "LC" },
  atcoder: { label: "AtCoder", color: "#22c55e", short: "AC" },
  codechef: { label: "CodeChef", color: "#b0793f", short: "CC" },
  cses: { label: "CSES", color: "#60a5fa", short: "CSES" },
};

export const TRACK_LABEL: Record<string, string> = {
  neetcode250: "NeetCode 250",
  codeforces: "Codeforces",
  cses: "CSES",
  upsolve: "Upsolve",
  review: "Practice",
  manual: "Free pick",
};

export function diffColor(raw: string | null | undefined, rating?: number | null): string {
  if (raw === "Easy") return "#22c55e";
  if (raw === "Medium") return "#f5b301";
  if (raw === "Hard") return "#ef4444";
  const r = rating ?? 0;
  if (r < 1200) return "#9ca3af";
  if (r < 1400) return "#22c55e";
  if (r < 1600) return "#22d3ee";
  if (r < 1900) return "#818cf8";
  if (r < 2100) return "#c084fc";
  if (r < 2400) return "#ff7a1a";
  return "#ef4444";
}

export const SLOWED_BY = [
  { id: "topic", label: "Didn't know the topic" },
  { id: "observation", label: "Missed an observation" },
  { id: "bugs", label: "Bugs" },
  { id: "misread", label: "Misread the problem" },
];

export const RESULT_LABEL: Record<string, string> = { solved: "Solved", solved_help: "Solved with help", gave_up: "Gave up" };
export const RESULT_COLOR: Record<string, string> = { solved: "#22c55e", solved_help: "#f5b301", gave_up: "#ef4444" };

export async function api<T = unknown>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: body instanceof FormData ? undefined : { "content-type": "application/json" }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export function refreshHeader() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cp:refresh"));
}
