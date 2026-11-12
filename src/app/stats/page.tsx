import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONCEPTS } from "@/lib/concepts";
import { level } from "@/lib/engine/mastery";
import { cfWindow, minutesSeries, trackProgress } from "@/lib/server/training";
import { getAccount } from "@/lib/server/settings";
import { SLOWED_BY } from "@/lib/ui";
import StatsCharts from "./StatsCharts";
import ConceptKeyboard from "@/components/ConceptKeyboard";
import { conceptKeys } from "@/lib/server/home";

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

  const cses = trackProgress("cses");
  const cfRating = getAccount("codeforces")?.rating;

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 pb-6">
      <h1 className="text-2xl font-semibold">Stats</h1>
      <div className="card grid grid-cols-2 divide-line md:grid-cols-3 xl:grid-cols-9 xl:divide-x">
        <Stat label="Hours" v={totals.hours} />
        <Stat label="Attempts" v={totals.attempts} />
        <Stat label="Solved alone" v={totals.solved} color="#6aa56f" />
        <Stat label="Re-solves" v={totals.resolves} />
        <Stat label="Mastered" v={totals.retired} color="#6aa56f" />
        <Stat label="Avg. felt" v={totals.avgFelt} sub="/ 5" />
        <Stat label="NeetCode" v={trackProgress("neetcode250").solved} sub="/ 250" />
        <Stat label="CSES" v={cses.solved} sub={`/ ${cses.total}`} />
        <Stat label="CF window" v={cfWindow()} sub={cfRating ? `rating ${cfRating}` : "not linked"} />
      </div>
      <section className="card px-6 pb-5 pt-4">
        <div className="eyebrow mb-3">Concepts</div>
        <ConceptKeyboard keys={conceptKeys()} size="sm" />
      </section>
      <StatsCharts series={minutesSeries(90)} byRating={byRating} phases={phases} slowed={slowed} mastery={mastery} />
    </div>
  );
}

function Stat({ label, v, color, sub }: { label: string; v: string | number; color?: string; sub?: string }) {
  return (
    <div className="px-3.5 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="num text-2xl font-semibold" style={{ color }}>{v}</span>
        {sub && <span className="text-xs text-mute">{sub}</span>}
      </div>
    </div>
  );
}
