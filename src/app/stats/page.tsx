import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONCEPTS } from "@/lib/concepts";
import { level } from "@/lib/engine/mastery";
import { cfWindow, minutesSeries, trackProgress } from "@/lib/server/training";
import { getAccount } from "@/lib/server/settings";
import { SLOWED_BY } from "@/lib/ui";
import StatsCharts from "./StatsCharts";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  const db = getDb();
  const done = db.select({ a: schema.attempts, p: schema.problems }).from(schema.attempts).innerJoin(schema.problems, eq(schema.problems.id, schema.attempts.problemId)).where(eq(schema.attempts.status, "done")).all();

  const ratingBuckets = new Map<number, { solved: number; help: number; gaveUp: number }>();
  for (const { a, p } of done) {
    const b = Math.floor((p.normRating ?? 800) / 100) * 100;
    const e = ratingBuckets.get(b) ?? { solved: 0, help: 0, gaveUp: 0 };
    if (a.result === "solved") e.solved++; else if (a.result === "solved_help") e.help++; else e.gaveUp++;
    ratingBuckets.set(b, e);
  }
  const byRating = [...ratingBuckets.entries()].sort((a, b) => a[0] - b[0]).map(([r, v]) => ({ rating: String(r), ...v }));

  const phases = done.reduce((s, { a }) => ({ think: s.think + a.thinkSec, stuck: s.stuck + a.stuckSec, code: s.code + a.codeSec }), { think: 0, stuck: 0, code: 0 });
  const slowed = SLOWED_BY.map((s) => ({ name: s.label, value: done.filter(({ a }) => a.slowedBy.includes(s.id)).length }));
  const mm = new Map(db.select().from(schema.conceptMastery).all().map((m) => [m.conceptId, m]));
  const mastery = CONCEPTS.filter((c) => mm.has(c.id)).map((c) => {
    const m = mm.get(c.id)!;
    return { name: c.name, score: Math.round(m.score * 100), attempts: m.attempts, status: m.weak ? "weak" : level(m.score, m.attempts) };
  }).sort((a, b) => a.score - b.score);
  const reviews = db.select().from(schema.reviews).all();

  const totals = {
    attempts: done.length,
    solved: done.filter(({ a }) => a.result === "solved").length,
    resolves: done.filter(({ a }) => a.isResolve).length,
    retired: reviews.filter((r) => r.status === "retired").length,
    hours: Math.round(((phases.think + phases.stuck + phases.code) / 3600) * 10) / 10,
    avgFelt: done.length ? Math.round((done.reduce((s, { a }) => s + (a.felt ?? 0), 0) / done.length) * 10) / 10 : 0,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Stats</h1>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Hours trained" v={totals.hours} />
        <Stat label="Attempts" v={totals.attempts} />
        <Stat label="Solved alone" v={totals.solved} color="#22c55e" />
        <Stat label="Re-solves done" v={totals.resolves} />
        <Stat label="Retired (mastered)" v={totals.retired} color="#22c55e" />
        <Stat label="Avg. felt difficulty" v={totals.avgFelt} color="#ff7a1a" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="NeetCode 250" v={`${trackProgress("neetcode250").solved} / 250`} color="#ff7a1a" />
        <Stat label="CSES main sections" v={`${trackProgress("cses").solved} / ${trackProgress("cses").total}`} />
        <Stat label="Codeforces window" v={`${cfWindow()}–${cfWindow() + 200}`} sub={getAccount("codeforces")?.rating ? `rating ${getAccount("codeforces")!.rating}` : "not linked"} />
      </div>
      <StatsCharts series={minutesSeries(90)} byRating={byRating} phases={phases} slowed={slowed} mastery={mastery} />
    </div>
  );
}

function Stat({ label, v, color, sub }: { label: string; v: string | number; color?: string; sub?: string }) {
  return (
    <div className="card card-pad">
      <div className="text-sm text-mute">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums" style={{ color }}>{v}</div>
      {sub && <div className="text-xs text-dim">{sub}</div>}
    </div>
  );
}
