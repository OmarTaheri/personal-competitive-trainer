import Link from "next/link";
import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { imagesFor } from "@/lib/server/training";
import { getSettings } from "@/lib/server/settings";
import { fmtDuration } from "@/lib/time";
import { PLATFORM_META, RESULT_COLOR, RESULT_LABEL, SLOWED_BY, TRACK_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";
const PAGE = 40;

export default async function LogPage({ searchParams }: { searchParams: Promise<{ q?: string; result?: string; page?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const tz = getSettings().timezone;
  const page = Math.max(1, Number(sp.page) || 1);
  const A = schema.attempts, P = schema.problems;
  const where: SQL[] = [eq(A.status, "done")];
  if (sp.q) where.push(or(like(P.title, `%${sp.q}%`), like(A.keyIdea, `%${sp.q}%`), like(A.notes, `%${sp.q}%`))!);
  if (sp.result) where.push(eq(A.result, sp.result));
  const cond = and(...where);
  const total = db.select({ n: sql<number>`count(*)` }).from(A).innerJoin(P, eq(P.id, A.problemId)).where(cond).get()!.n;
  const rows = db.select({ a: A, p: P }).from(A).innerJoin(P, eq(P.id, A.problemId)).where(cond).orderBy(desc(A.startedAt)).limit(PAGE).offset((page - 1) * PAGE).all();
  const imgs = imagesFor(rows.map((r) => r.a.id));
  const slowLabel = Object.fromEntries(SLOWED_BY.map((s) => [s.id, s.label]));
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Training log</h1>
        <p className="text-mute">{total} finished attempts · search key ideas and notes</p>
      </div>
      <form className="card card-pad flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q} placeholder="Search problem, key idea or notes…" className="input max-w-md" />
        <select name="result" defaultValue={sp.result ?? ""} className="input max-w-52">
          <option value="">All results</option>
          {Object.entries(RESULT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-primary">Search</button>
      </form>

      <div className="space-y-3">
        {rows.map(({ a, p }) => {
          const m = PLATFORM_META[p.platform];
          const total = a.thinkSec + a.stuckSec + a.codeSec;
          const im = imgs.get(a.id) ?? [];
          return (
            <details key={a.id} className="card group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                <span className="w-28 text-sm text-mute">{new Date(a.startedAt).toLocaleDateString(undefined, { timeZone: tz, month: "short", day: "numeric", year: "2-digit" })}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: m?.color }}>{m?.short}</span>
                <a href={p.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold hover:text-accent">{p.title}</a>
                {a.isResolve && <span className="chip !text-xs text-green">re-solve</span>}
                <span className="chip !text-xs">{TRACK_LABEL[a.trackId ?? "manual"] ?? a.trackId}</span>
                <span className="font-semibold" style={{ color: RESULT_COLOR[a.result ?? ""] }}>{RESULT_LABEL[a.result ?? ""]}</span>
                <span className="w-20 text-right font-mono">{fmtDuration(total)}</span>
                <span className="w-16 text-right text-sm text-mute">felt {a.felt}/5</span>
                {im.length > 0 && <span className="text-sm">📷 {im.length}</span>}
              </summary>
              <div className="grid gap-4 border-t border-line px-5 py-4 md:grid-cols-[1fr_1fr]">
                <div className="space-y-2">
                  <div><span className="text-mute">Key idea: </span><b>{a.keyIdea}</b></div>
                  <div className="text-sm text-mute">💭 {fmtDuration(a.thinkSec)} · 😵 {fmtDuration(a.stuckSec)} · ⌨ {fmtDuration(a.codeSec)} · expected {a.expectedMin} min · help: {a.helpUsed}</div>
                  {a.slowedBy.length > 0 && <div className="flex flex-wrap gap-1">{a.slowedBy.map((s) => <span key={s} className="chip !text-xs text-accent">{slowLabel[s] ?? s}</span>)}</div>}
                  {a.notes && <div className="whitespace-pre-wrap rounded-xl bg-panel2 p-3 text-sm">{a.notes}</div>}
                </div>
                <div className="flex flex-wrap gap-3">
                  {im.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-40 rounded-xl border border-line object-cover" /></a>)}
                </div>
              </div>
            </details>
          );
        })}
        {!rows.length && <div className="card card-pad text-center text-dim">No attempts yet. <Link href="/train" className="text-accent">Start training →</Link></div>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && <Link className="btn" href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>← Prev</Link>}
          <span className="text-mute">Page {page} / {pages}</span>
          {page < pages && <Link className="btn" href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
