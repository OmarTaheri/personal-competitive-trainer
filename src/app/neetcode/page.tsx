import { asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ensureSeeded } from "@/lib/server/seed";
import NeetcodeClient, { type NcTopic } from "./NeetcodeClient";

export const dynamic = "force-dynamic";

export default function NeetcodePage() {
  ensureSeeded();
  const db = getDb();
  const rows = db.select({ pos: schema.trackItems.position, p: schema.problems }).from(schema.trackItems)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.trackItems.problemId))
    .where(eq(schema.trackItems.trackId, "neetcode250")).orderBy(asc(schema.trackItems.position)).all();
  const lastResult = new Map<number, string | null>();
  if (rows.length) for (const a of db.select({ pid: schema.attempts.problemId, r: schema.attempts.result }).from(schema.attempts).where(inArray(schema.attempts.problemId, rows.map((r) => r.p.id))).orderBy(asc(schema.attempts.startedAt)).all()) lastResult.set(a.pid, a.r);

  const topics: NcTopic[] = [];
  for (const { pos, p } of rows) {
    const t = p.section ?? "Other";
    let g = topics.find((x) => x.name === t);
    if (!g) topics.push((g = { name: t, items: [] }));
    g.items.push({ id: p.id, pos, title: p.title, url: p.url, difficulty: p.rawDifficulty, solved: p.solved, last: lastResult.has(p.id) ? lastResult.get(p.id) : undefined });
  }
  const nextId = rows.find((r) => !r.p.solved && !lastResult.has(r.p.id))?.p.id ?? null;

  return <NeetcodeClient topics={topics} nextId={nextId} />;
}
