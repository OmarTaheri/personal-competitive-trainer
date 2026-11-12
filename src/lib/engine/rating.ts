/** Normalizes every platform's difficulty onto the Codeforces scale. */

export type Table = [number, number][];

export const DEFAULT_ATCODER_TABLE: Table = [
  // kenkoooo difficulty → CF. Anchors: ABC C ≈ 1000–1200, D ≈ 1300–1500, E ≈ 1600–1800, F ≈ 1900–2200.
  [0, 800], [400, 1000], [800, 1300], [1200, 1550], [1600, 1850], [2000, 2150], [2400, 2400], [2800, 2700], [3200, 3000], [4000, 3500],
];
export const DEFAULT_CODECHEF_TABLE: Table = [
  [0, 800], [1000, 800], [1400, 1100], [1600, 1300], [1800, 1500], [2000, 1700], [2200, 1900], [2500, 2200], [3000, 2700], [3500, 3200],
];

export function interpolate(table: Table, x: number): number {
  const t = [...table].sort((a, b) => a[0] - b[0]);
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][0]) {
      const [x0, y0] = t[i - 1], [x1, y1] = t[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return t[t.length - 1][1];
}

const round50 = (x: number) => Math.round(x / 50) * 50;

export const LC_BANDS: Record<string, [number, number]> = { Easy: [800, 1100], Medium: [1200, 1700], Hard: [1800, 2400] };

/**
 * LeetCode: place inside the band. Best: `hardness` = percentile of the problem's
 * acceptance rate among all problems of the same difficulty (0 = most accepted,
 * 1 = least accepted) — spreads problems evenly across the band. Without it we
 * fall back to a rough acceptance-rate scale.
 */
export function leetcodeRating(difficulty: string, acRate?: number | null, hardness?: number | null): number {
  const [lo, hi] = LC_BANDS[difficulty] ?? LC_BANDS.Medium;
  if (hardness != null) return round50(lo + Math.min(1, Math.max(0, hardness)) * (hi - lo));
  if (acRate == null) return round50((lo + hi) / 2);
  const f = Math.min(1, Math.max(0, (85 - acRate) / 60));
  return round50(lo + f * (hi - lo));
}

/** Percentile ranks (0..1) of acceptance rate within each difficulty; higher = harder. */
export function leetcodeHardness(rows: { id: number; difficulty: string | null; acRate: number | null }[]): Map<number, number> {
  const out = new Map<number, number>();
  const groups = new Map<string, { id: number; acRate: number }[]>();
  for (const r of rows) if (r.acRate != null && r.difficulty) groups.set(r.difficulty, [...(groups.get(r.difficulty) ?? []), { id: r.id, acRate: r.acRate }]);
  for (const g of groups.values()) {
    g.sort((a, b) => b.acRate - a.acRate);
    g.forEach((r, i) => out.set(r.id, g.length <= 1 ? 0.5 : i / (g.length - 1)));
  }
  return out;
}

/** kenkoooo's raw difficulty can be negative; they clip it like this for display. */
export function atcoderClip(d: number): number {
  return d >= 400 ? d : 400 / Math.exp((400 - d) / 400);
}

export function atcoderRating(raw: number, table: Table = DEFAULT_ATCODER_TABLE): number {
  return round50(interpolate(table, atcoderClip(raw)));
}

export function codechefRating(raw: number, table: Table = DEFAULT_CODECHEF_TABLE): number {
  return round50(interpolate(table, raw));
}

const CSES_BANDS: Record<string, [number, number]> = {
  "Introductory Problems": [800, 1600],
  "Sorting and Searching": [1000, 2000],
  "Dynamic Programming": [1200, 2100],
  "Graph Algorithms": [1200, 2300],
  "Range Queries": [1300, 2300],
  "Tree Algorithms": [1300, 2400],
  Mathematics: [1200, 2500],
};

/** CSES: section band, placed by rank of solver count inside the section (0 = most solved). */
export function csesRating(section: string, rank: number, sectionSize: number): number {
  const [lo, hi] = CSES_BANDS[section] ?? [1700, 2700];
  const f = sectionSize <= 1 ? 0 : rank / (sectionSize - 1);
  return round50(lo + f * (hi - lo));
}

/** Default minutes by CF-scale rating (used until you have your own times for that band). */
export const DEFAULT_TIME_TABLE: Table = [[800, 20], [1200, 30], [1600, 45], [2000, 65], [2400, 90], [3000, 120]];

/** Default expected minutes: LeetCode Easy 20 / Medium 40 / Hard 60; others from DEFAULT_TIME_TABLE. */
export function expectedMinutes(platform: string, rawDifficulty: string | null | undefined, normRating: number | null | undefined): number {
  if (platform === "leetcode") {
    if (rawDifficulty === "Easy") return 20;
    if (rawDifficulty === "Hard") return 60;
    return 40;
  }
  return Math.round(interpolate(DEFAULT_TIME_TABLE, normRating ?? 1200) / 5) * 5;
}

/** Which "time band" a problem belongs to: LeetCode by difficulty, everything else by 200-rating band. */
export function timeBand(platform: string, rawDifficulty: string | null | undefined, normRating: number | null | undefined): string {
  if (platform === "leetcode") return `LeetCode ${rawDifficulty ?? "Medium"}`;
  const lo = Math.floor((normRating ?? 1200) / 200) * 200;
  return `${lo}-${lo + 199}`;
}

export const PERSONAL_MIN_SAMPLES = 5;

/** Median of your solve times (minutes) once a band has enough samples. */
export function personalMinutes(samples: number[]): number | null {
  if (samples.length < PERSONAL_MIN_SAMPLES) return null;
  const s = [...samples].sort((a, b) => a - b);
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return Math.max(5, Math.round(m));
}
