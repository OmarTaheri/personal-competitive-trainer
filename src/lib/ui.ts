/** Palette for places that need raw colors (SVG, Recharts, inline styles). Mirrors globals.css (keybr dark). */
export const C = {
  bg: "#333333",
  panel: "#2e2e2e",
  panel2: "#3a3a3a",
  line: "#404040",
  ink: "#d0cece",
  mute: "#9f9999",
  dim: "#747070",
  accent: "#4ba0f2",
  green: "#6aa56f",
  amber: "#c49a45",
  red: "#c06060",
  violet: "#9a7bc0",
  cyan: "#5aa6a6",
  untried: "#404040",
};

/** Muted key colors like keybr's: slow/weak red -> ochre -> fast/strong green. */
const STOPS: [number, number, number][] = [[139, 74, 71], [143, 118, 56], [79, 125, 86]];
function mix(t: number): [number, number, number] {
  const u = Math.min(1, Math.max(0, t)) * 2;
  const [a, b] = u <= 1 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const f = u <= 1 ? u : u - 1;
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number];
}
const toT = (score: number) => (score - 0.3) / 0.6;

/** Mastery -> key fill (score 0.3 -> 0.9 maps red -> ochre -> green). Untried = flat grey. */
export function masteryColor(score: number | null | undefined, attempts?: number | null): string {
  if (!attempts || score == null) return C.untried;
  const [r, g, b] = mix(toT(score));
  return `rgb(${r} ${g} ${b})`;
}
/** Brighter version of the same color, for text/dots on the dark background. */
export function masteryInk(score: number | null | undefined, attempts?: number | null): string {
  if (!attempts || score == null) return C.dim;
  const [r, g, b] = mix(toT(score)).map((v) => Math.min(255, Math.round(v * 1.45)));
  return `rgb(${r} ${g} ${b})`;
}
export const STATUS_COLOR: Record<string, string> = { strong: C.green, learning: C.amber, weak: C.red, new: C.dim };

export const PLATFORM_META: Record<string, { label: string; color: string; short: string }> = {
  codeforces: { label: "Codeforces", color: "#c8763f", short: "CF" },
  leetcode: { label: "LeetCode", color: "#c49a45", short: "LC" },
  atcoder: { label: "AtCoder", color: "#6aa56f", short: "AC" },
  codechef: { label: "CodeChef", color: "#a97c55", short: "CC" },
  cses: { label: "CSES", color: "#4ba0f2", short: "CSES" },
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
  if (r < 1200) return "#9f9999";
  if (r < 1400) return C.green;
  if (r < 1600) return C.cyan;
  if (r < 1900) return "#7f8fe0";
  if (r < 2100) return C.violet;
  if (r < 2400) return "#d98a4a";
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
