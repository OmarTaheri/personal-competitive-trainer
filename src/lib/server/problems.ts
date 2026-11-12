import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Problem } from "@/db/schema";

export type ProblemUpsert = {
  platform: string;
  externalId: string;
  title: string;
  url: string;
  rawDifficulty?: string | null;
  normRating?: number | null;
  tags?: string[];
  section?: string | null;
  solveCount?: number | null;
  acRate?: number | null;
  paidOnly?: boolean;
  videoUrl?: string | null;
  editorialUrl?: string | null;
  contestId?: string | null;
};

/** Insert or update by (platform, externalId). Keeps solved status and fields not provided. */
export function upsertProblem(p: ProblemUpsert): number {
  const db = getDb();
  const set: Record<string, unknown> = { title: p.title, url: p.url };
  for (const k of ["rawDifficulty", "normRating", "tags", "section", "solveCount", "acRate", "paidOnly", "videoUrl", "editorialUrl", "contestId"] as const) {
    if (p[k] !== undefined) set[k] = p[k];
  }
  const row = db
    .insert(schema.problems)
    .values({ ...p, tags: p.tags ?? [] })
    .onConflictDoUpdate({ target: [schema.problems.platform, schema.problems.externalId], set })
    .returning({ id: schema.problems.id })
    .get();
  return row.id;
}

export function setConcepts(problemId: number, conceptIds: string[]) {
  const db = getDb();
  db.delete(schema.problemConcepts).where(eq(schema.problemConcepts.problemId, problemId)).run();
  if (conceptIds.length) db.insert(schema.problemConcepts).values(conceptIds.map((c) => ({ problemId, conceptId: c }))).onConflictDoNothing().run();
}

export function addConcepts(problemId: number, conceptIds: string[]) {
  if (!conceptIds.length) return;
  getDb().insert(schema.problemConcepts).values(conceptIds.map((c) => ({ problemId, conceptId: c }))).onConflictDoNothing().run();
}

export function conceptsOf(problemIds: number[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  if (!problemIds.length) return out;
  const db = getDb();
  for (let i = 0; i < problemIds.length; i += 500) {
    const rows = db.select().from(schema.problemConcepts).where(inArray(schema.problemConcepts.problemId, problemIds.slice(i, i + 500))).all();
    for (const r of rows) {
      const a = out.get(r.problemId) ?? [];
      a.push(r.conceptId);
      out.set(r.problemId, a);
    }
  }
  return out;
}

export function getProblem(id: number): Problem | undefined {
  return getDb().select().from(schema.problems).where(eq(schema.problems.id, id)).get();
}

export function getProblems(ids: number[]): Map<number, Problem> {
  const out = new Map<number, Problem>();
  if (!ids.length) return out;
  for (const p of getDb().select().from(schema.problems).where(inArray(schema.problems.id, ids)).all()) out.set(p.id, p);
  return out;
}

export function markSolved(platform: string, externalIds: string[], source: "sync" | "app", at = Date.now()): number {
  if (!externalIds.length) return 0;
  const db = getDb();
  let n = 0;
  for (let i = 0; i < externalIds.length; i += 500) {
    const res = db
      .update(schema.problems)
      .set({ solved: true, solvedAt: at, solvedSource: source })
      .where(and(eq(schema.problems.platform, platform), inArray(schema.problems.externalId, externalIds.slice(i, i + 500)), eq(schema.problems.solved, false)))
      .run();
    n += res.changes;
  }
  return n;
}

export function markProblemSolved(problemId: number) {
  getDb().update(schema.problems).set({ solved: true, solvedAt: Date.now(), solvedSource: "app" }).where(and(eq(schema.problems.id, problemId), eq(schema.problems.solved, false))).run();
}

export function countByPlatform() {
  return getDb()
    .select({ platform: schema.problems.platform, total: sql<number>`count(*)`, solved: sql<number>`sum(${schema.problems.solved})` })
    .from(schema.problems)
    .groupBy(schema.problems.platform)
    .all();
}
