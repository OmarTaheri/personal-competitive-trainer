/**
 * Builds today's queue. Pure function: all data comes in, the queue comes out.
 *
 * 1. Due re-solves (capped, oldest first) — interleaved with new problems so the
 *    order never gives them away.
 * 2. Main track: next unsolved NeetCode 250 problem in list order. Every Nth slot
 *    (default 3rd) takes the next unsolved *list* problem from your weakest concept,
 *    so the list still moves to 100% but weak topics come sooner.
 * 3. Secondary tracks fill the rest by time share (minutes, not counts):
 *    Codeforces random in window (×2 weight for weak / boosted concepts),
 *    CSES in section order (boosted problems pulled forward within the next few).
 * 4. Upsolve problems from recent contests go in before secondary tracks.
 * 5. Adaptive (the plan is rebuilt after every problem):
 *    - `focus`: concepts you just struggled with (help / gave up / slow). The very next
 *      NeetCode slot takes the next unsolved *list* problem of that concept, and focus
 *      concepts come before weak ones in the weak slots and CSES lookahead.
 *    - `momentum` ≥ 2 (several fast, clean solves in a row): skip ahead to the next
 *      Medium/Hard of the list for one slot. The CF window shift is applied by the caller.
 */

export type Cand = { problemId: number; concepts: string[]; expectedMin: number; difficulty?: string | null };
export type PlannedItem = { problemId: number; trackId: string; kind: "new" | "review" | "upsolve"; expectedMin: number };

export type PlanInput = {
  goalMin: number;
  doneMin: number;
  shares: { neetcode: number; codeforces: number; cses: number };
  dueReviews: (Cand & { trackId: string })[]; // already sorted oldest due first
  resolveCap: number;
  neetcode: Cand[]; // unsolved, list order
  codeforces: Cand[]; // unsolved, inside the rating window
  cses: Cand[]; // unsolved, track order
  upsolves: Cand[];
  weakConcepts: string[]; // weakest first
  boostConcepts: string[]; // weak + recently finished NeetCode topics
  weakEvery: number;
  focus?: string[]; // concepts you struggled with today, most recent first
  momentum?: number; // -2..2 from today's last results
  exclude?: Set<number>; // problems already in today's queue
  rng?: () => number;
};

export type PlanOutput = { items: PlannedItem[]; overflowReviews: number };

export function buildPlan(inp: PlanInput): PlanOutput {
  const rng = inp.rng ?? Math.random;
  const used = new Set<number>(inp.exclude ?? []);
  const take = (c: Cand) => used.add(c.problemId);

  const dueAll = inp.dueReviews.filter((r) => !used.has(r.problemId));
  const reviews = dueAll.slice(0, Math.max(0, inp.resolveCap));
  reviews.forEach(take);
  const reviewMin = reviews.reduce((s, r) => s + r.expectedMin, 0);

  let remaining = Math.max(0, inp.goalMin - inp.doneMin - reviewMin);

  // NeetCode finished → its share goes to Codeforces.
  let { neetcode: sN, codeforces: sC, cses: sS } = inp.shares;
  const ncLeft = inp.neetcode.filter((c) => !used.has(c.problemId));
  if (ncLeft.length === 0) { sC += sN; sN = 0; }
  const total = sN + sC + sS || 1;

  // Upsolves come out of the Codeforces/secondary budget first.
  const upsolveItems: PlannedItem[] = [];
  for (const u of inp.upsolves) {
    if (used.has(u.problemId) || remaining <= 0) continue;
    if (upsolveItems.length >= 2) break;
    take(u);
    upsolveItems.push({ problemId: u.problemId, trackId: "upsolve", kind: "upsolve", expectedMin: u.expectedMin });
    remaining -= u.expectedMin;
  }
  remaining = Math.max(0, remaining);

  const budget = { nc: (remaining * sN) / total, cf: (remaining * sC) / total, cs: (remaining * sS) / total };

  // --- NeetCode ---
  const ncItems: PlannedItem[] = [];
  let ncMin = 0;
  let slot = 0;
  const focus = inp.focus ?? [];
  const weakOrder = [...new Set([...focus, ...inp.weakConcepts])];
  const fromConcepts = (list: string[]) => {
    for (const w of list) {
      const c = ncLeft.find((x) => !used.has(x.problemId) && x.concepts.includes(w));
      if (c) return c;
    }
    return undefined;
  };
  while (ncMin < budget.nc) {
    slot++;
    let pick: Cand | undefined;
    if (slot === 1 && focus.length) pick = fromConcepts(focus); // reinforce what you just struggled with
    else if (slot === 1 && (inp.momentum ?? 0) >= 2) {
      // On a roll: next harder list problem (within the next few) instead of an easy one.
      pick = ncLeft.filter((c) => !used.has(c.problemId)).slice(0, 8).find((c) => c.difficulty === "Medium" || c.difficulty === "Hard");
    }
    if (!pick && inp.weakEvery > 0 && slot % inp.weakEvery === 0) pick = fromConcepts(weakOrder);
    pick ??= ncLeft.find((c) => !used.has(c.problemId));
    if (!pick) break;
    take(pick);
    ncItems.push({ problemId: pick.problemId, trackId: "neetcode250", kind: "new", expectedMin: pick.expectedMin });
    ncMin += pick.expectedMin;
  }

  // --- Codeforces (weighted random) ---
  const cfItems: PlannedItem[] = [];
  let cfMin = 0;
  const boost = new Set([...inp.boostConcepts, ...focus]);
  const cfPool = inp.codeforces.filter((c) => !used.has(c.problemId));
  while (cfMin < budget.cf && cfPool.length) {
    const weights = cfPool.map((c) => (c.concepts.some((x) => boost.has(x)) ? 2 : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = rng() * sum, i = 0;
    while (i < cfPool.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
    const pick = cfPool.splice(i, 1)[0];
    take(pick);
    cfItems.push({ problemId: pick.problemId, trackId: "codeforces", kind: "new", expectedMin: pick.expectedMin });
    cfMin += pick.expectedMin;
  }

  // --- CSES (ordered; boosted pulled forward within a small lookahead) ---
  const csItems: PlannedItem[] = [];
  let csMin = 0;
  const csPool = inp.cses.filter((c) => !used.has(c.problemId));
  const LOOKAHEAD = 5;
  while (csMin < budget.cs && csPool.length) {
    let idx = csPool.slice(0, LOOKAHEAD).findIndex((c) => c.concepts.some((x) => boost.has(x)));
    if (idx < 0) idx = 0;
    const pick = csPool.splice(idx, 1)[0];
    take(pick);
    csItems.push({ problemId: pick.problemId, trackId: "cses", kind: "new", expectedMin: pick.expectedMin });
    csMin += pick.expectedMin;
  }

  // New problems in priority order: main track, upsolves, then secondaries interleaved.
  const secondaries = interleave(cfItems, csItems);
  const fresh = [...ncItems, ...upsolveItems, ...secondaries];

  // Interleave reviews: review, new, review, new... so they stay early but not obvious.
  const reviewItems: PlannedItem[] = reviews.map((r) => ({ problemId: r.problemId, trackId: r.trackId, kind: "review", expectedMin: r.expectedMin }));
  const items = interleave(reviewItems, fresh);

  return { items, overflowReviews: dueAll.length - reviews.length };
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** Codeforces window update: last 10 attempts in the window since it last changed. */
export function nextWindow(windowLo: number, recent: { solvedNoEditorial: boolean }[]): number {
  if (recent.length < 10) return windowLo;
  const last = recent.slice(-10);
  const ok = last.filter((r) => r.solvedNoEditorial).length;
  if (ok >= 7) return windowLo + 100;
  if (ok < 4) return Math.max(800, windowLo - 100);
  return windowLo;
}
