import { and, eq, inArray, like, notInArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { atcoderRating, csesRating, leetcodeHardness, leetcodeRating } from "@/lib/engine/rating";
import { getSettings, tables } from "./settings";

const RATINGS_VERSION = "ratings:v2";

/**
 * Re-normalizes every LeetCode / AtCoder / CSES problem onto the CF scale with the
 * current rules, and drops AtCoder Daily Training duplicates. Safe to run any time.
 */
export function recomputeRatings(): string {
  const db = getDb();
  const at = tables(getSettings()).atcoder;
  let lc = 0, ac = 0, cs = 0, dropped = 0;
  db.transaction(() => {
    // LeetCode: percentile of acceptance rate inside each difficulty band.
    const lcRows = db.select({ id: schema.problems.id, difficulty: schema.problems.rawDifficulty, acRate: schema.problems.acRate }).from(schema.problems).where(eq(schema.problems.platform, "leetcode")).all();
    const hard = leetcodeHardness(lcRows);
    for (const r of lcRows) {
      db.update(schema.problems).set({ normRating: leetcodeRating(r.difficulty ?? "Medium", r.acRate, hard.get(r.id)) }).where(eq(schema.problems.id, r.id)).run();
      lc++;
    }

    // AtCoder: drop "adt_*" duplicates nobody has attempted, re-map the rest.
    const attempted = db.selectDistinct({ id: schema.attempts.problemId }).from(schema.attempts).all().map((r) => r.id);
    const adt = db.select({ id: schema.problems.id }).from(schema.problems)
      .where(and(eq(schema.problems.platform, "atcoder"), like(schema.problems.contestId, "adt_%"), attempted.length ? notInArray(schema.problems.id, attempted) : undefined)).all().map((r) => r.id);
    for (let i = 0; i < adt.length; i += 500) {
      const chunk = adt.slice(i, i + 500);
      db.delete(schema.problemConcepts).where(inArray(schema.problemConcepts.problemId, chunk)).run();
      db.delete(schema.problems).where(inArray(schema.problems.id, chunk)).run();
    }
    dropped = adt.length;
    for (const r of db.select({ id: schema.problems.id, raw: schema.problems.rawDifficulty }).from(schema.problems).where(eq(schema.problems.platform, "atcoder")).all()) {
      const d = Number(r.raw);
      if (!Number.isFinite(d)) continue;
      db.update(schema.problems).set({ normRating: atcoderRating(d, at) }).where(eq(schema.problems.id, r.id)).run();
      ac++;
    }

    // CSES: section band, ranked by solver count.
    const csRows = db.select({ id: schema.problems.id, section: schema.problems.section, solvers: schema.problems.solveCount }).from(schema.problems).where(eq(schema.problems.platform, "cses")).all();
    const bySection = new Map<string, typeof csRows>();
    for (const r of csRows) bySection.set(r.section ?? "", [...(bySection.get(r.section ?? "") ?? []), r]);
    for (const [section, items] of bySection) {
      items.sort((a, b) => (b.solvers ?? 0) - (a.solvers ?? 0));
      items.forEach((r, rank) => db.update(schema.problems).set({ normRating: csesRating(section, rank, items.length) }).where(eq(schema.problems.id, r.id)).run());
      cs += items.length;
    }
  });
  return `re-rated ${lc} LeetCode, ${ac} AtCoder, ${cs} CSES; removed ${dropped} AtCoder Daily Training duplicates`;
}

/** Runs the re-rating once per rules version. */
export function ensureRatingsCurrent() {
  const db = getDb();
  if (db.select().from(schema.syncLog).where(eq(schema.syncLog.job, RATINGS_VERSION)).get()) return;
  const message = recomputeRatings();
  db.insert(schema.syncLog).values({ at: Date.now(), job: RATINGS_VERSION, ok: true, message }).run();
}
