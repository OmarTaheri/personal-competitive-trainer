import Link from "next/link";
import { and, asc, desc, eq, inArray, like, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONCEPTS, CONCEPT_BY_ID } from "@/lib/concepts";
import { conceptsOf } from "@/lib/server/problems";
import { ensureSeeded } from "@/lib/server/seed";
import { diffColor, PLATFORM_META, RESULT_COLOR, RESULT_LABEL } from "@/lib/ui";
import { SolvedToggle, TrainThis } from "@/components/RowActions";

export const dynamic = "force-dynamic";
const PAGE = 50;

type SP = { q?: string; platform?: string; concept?: string; status?: string; sort?: string; page?: string; min?: string; max?: string };

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<SP> }) {
  ensureSeeded();
  const sp = await searchParams;
  const db = getDb();
  const page = Math.max(1, Number(sp.page) || 1);
  const P = schema.problems;

  const where: SQL[] = [];
  if (sp.q) where.push(like(P.title, `%${sp.q}%`));
  if (sp.platform) where.push(eq(P.platform, sp.platform));
  if (sp.min) where.push(sql`${P.normRating} >= ${Number(sp.min)}`);
  if (sp.max) where.push(sql`${P.normRating} <= ${Number(sp.max)}`);
  if (sp.status === "solved") where.push(eq(P.solved, true));
  if (sp.status === "unsolved") where.push(eq(P.solved, false));
  if (sp.status === "attempted") where.push(sql`${P.id} in (select problem_id from attempts)`);
  if (sp.concept) where.push(sql`${P.id} in (select problem_id from problem_concepts where concept_id = ${sp.concept})`);
  const cond = where.length ? and(...where) : undefined;

  const order = sp.sort === "rating_desc" ? [desc(P.normRating)] : sp.sort === "rating" ? [asc(P.normRating)] : sp.sort === "title" ? [asc(P.title)] : [desc(P.solvedAt), asc(P.platform), asc(P.id)];
  const total = db.select({ n: sql<number>`count(*)` }).from(P).where(cond).get()!.n;
  const rows = db.select().from(P).where(cond).orderBy(...order).limit(PAGE).offset((page - 1) * PAGE).all();
  const cm = conceptsOf(rows.map((r) => r.id));
  const last = new Map<number, { result: string | null; startedAt: number; n: number }>();
  if (rows.length) {
    for (const a of db.select({ pid: schema.attempts.problemId, result: schema.attempts.result, startedAt: schema.attempts.startedAt }).from(schema.attempts)
      .where(inArray(schema.attempts.problemId, rows.map((r) => r.id))).orderBy(asc(schema.attempts.startedAt)).all()) {
      last.set(a.pid, { result: a.result, startedAt: a.startedAt, n: (last.get(a.pid)?.n ?? 0) + 1 });
    }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (patch: Partial<SP>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black">Problem bank</h1>
          <p className="text-mute">{total.toLocaleString()} problems · ratings normalized to the Codeforces scale</p>
        </div>
      </div>

      <form className="card card-pad grid gap-3 md:grid-cols-[2fr_1fr_1.4fr_1fr_0.7fr_0.7fr_1fr_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search title…" className="input" />
        <select name="platform" defaultValue={sp.platform ?? ""} className="input">
          <option value="">All platforms</option>
          {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="concept" defaultValue={sp.concept ?? ""} className="input">
          <option value="">All concepts</option>
          {CONCEPTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input">
          <option value="">Any status</option>
          <option value="solved">Solved</option>
          <option value="unsolved">Unsolved</option>
          <option value="attempted">Attempted here</option>
        </select>
        <input name="min" defaultValue={sp.min} placeholder="min" className="input" inputMode="numeric" />
        <input name="max" defaultValue={sp.max} placeholder="max" className="input" inputMode="numeric" />
        <select name="sort" defaultValue={sp.sort ?? ""} className="input">
          <option value="">Recently solved</option>
          <option value="rating">Rating ↑</option>
          <option value="rating_desc">Rating ↓</option>
          <option value="title">Title</option>
        </select>
        <button className="btn btn-orange">Filter</button>
      </form>

      <div className="card overflow-x-auto scroll-thin">
        <table className="tbl">
          <thead><tr><th className="w-10">✓</th><th>Problem</th><th>Platform</th><th>Difficulty</th><th>Rating</th><th>Concepts</th><th>Your attempts</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => {
              const m = PLATFORM_META[p.platform];
              const l = last.get(p.id);
              return (
                <tr key={p.id}>
                  <td><SolvedToggle id={p.id} solved={p.solved} /></td>
                  <td className="max-w-[28rem]">
                    <a href={p.url} target="_blank" rel="noreferrer" className="font-medium hover:text-orange">{p.title}</a>
                    {p.paidOnly && <span className="ml-2 text-xs text-amber">premium</span>}
                    {p.section && p.platform !== "codeforces" && <div className="text-xs text-dim">{p.section}</div>}
                  </td>
                  <td><span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-black" style={{ background: m?.color }}>{m?.short ?? p.platform}</span></td>
                  <td style={{ color: diffColor(p.rawDifficulty, p.normRating) }}>{p.platform === "leetcode" ? p.rawDifficulty : p.platform === "cses" ? "—" : p.rawDifficulty}</td>
                  <td className="font-mono" style={{ color: diffColor(null, p.normRating) }}>{p.normRating ?? "—"}</td>
                  <td className="max-w-[16rem]">
                    <div className="flex flex-wrap gap-1">{(cm.get(p.id) ?? []).map((c) => <Link key={c} href={qs({ concept: c, page: "1" })} className="chip !py-0 !text-[11px] text-mute hover:text-orange">{CONCEPT_BY_ID.get(c)?.name ?? c}</Link>)}</div>
                  </td>
                  <td>{l ? <span style={{ color: RESULT_COLOR[l.result ?? ""] }}>{RESULT_LABEL[l.result ?? ""] ?? "in progress"}<span className="text-dim"> · {l.n}×</span></span> : <span className="text-dim">—</span>}</td>
                  <td><TrainThis id={p.id} url={p.url} /></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8} className="py-10 text-center text-dim">No problems match. Codeforces/AtCoder/LeetCode banks import from Settings → Problem bank.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        {page > 1 && <Link className="btn" href={qs({ page: String(page - 1) })}>← Prev</Link>}
        <span className="text-mute">Page {page} / {pages}</span>
        {page < pages && <Link className="btn" href={qs({ page: String(page + 1) })}>Next →</Link>}
      </div>
    </div>
  );
}
