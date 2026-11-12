/** Palette for places that need raw colors (SVG, Recharts, inline styles). Mirrors globals.css. */
export const C = {
  bg: "#f7f7f5",
  panel: "#ffffff",
  panel2: "#f0f0ed",
  line: "#e3e3df",
  ink: "#1f2328",
  mute: "#6b6f76",
  dim: "#9a9ea5",
  accent: "#2f6fde",
  green: "#2e9d57",
  amber: "#d99a00",
  red: "#d64545",
  violet: "#7c5cd6",
  cyan: "#1c9bb5",
  untried: "#e8e8e4",
};

/**
 * Mastery -> color on a continuous red -> yellow -> green scale (score 0.3 -> 0.9).
 * Untried concepts are a flat neutral grey.
 */
export function masteryColor(score: number | null | undefined, attempts?: number | null): string {
  if (!attempts || score == null) return C.untried;
  const t = Math.min(1, Math.max(0, (score - 0.3) / 0.6));
  return `hsl(${Math.round(t * 130)} 62% 72%)`;
}
/** Stronger version of the same hue, for text/dots on white. */
export function masteryInk(score: number | null | undefined, attempts?: number | null): string {
  if (!attempts || score == null) return C.dim;
  const t = Math.min(1, Math.max(0, (score - 0.3) / 0.6));
  return `hsl(${Math.round(t * 130)} 60% 40%)`;
}
export const STATUS_COLOR: Record<string, string> = { strong: C.green, learning: C.amber, weak: C.red, new: C.dim };

export const PLATFORM_META: Record<string, { label: string; color: string; short: string }> = {
  codeforces: { label: "Codeforces", color: "#e0662b", short: "CF" },
  leetcode: { label: "LeetCode", color: "#d99a00", short: "LC" },
  atcoder: { label: "AtCoder", color: "#2e9d57", short: "AC" },
  codechef: { label: "CodeChef", color: "#b0793f", short: "CC" },
  cses: { label: "CSES", color: "#2f6fde", short: "CSES" },
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
  if (raw === "Easy") return C.green;
  if (raw === "Medium") return C.amber;
  if (raw === "Hard") return C.red;
  const r = rating ?? 0;
  if (r < 1200) return "#7d8590";
  if (r < 1400) return C.green;
  if (r < 1600) return C.cyan;
  if (r < 1900) return "#4f62d8";
  if (r < 2100) return C.violet;
  if (r < 2400) return "#e0662b";
  return C.red;
}

export const SLOWED_BY = [
  { id: "topic", label: "Didn't know the topic" },
  { id: "observation", label: "Missed an observation" },
  { id: "bugs", label: "Bugs" },
  { id: "misread", label: "Misread the problem" },
];

export const RESULT_LABEL: Record<string, string> = { solved: "Solved", solved_help: "Solved with help", gave_up: "Gave up" };
export const RESULT_COLOR: Record<string, string> = { solved: C.green, solved_help: C.amber, gave_up: C.red };

export async function api<T = unknown>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: body instanceof FormData ? undefined : { "content-type": "application/json" }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export function refreshHeader() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cp:refresh"));
}
