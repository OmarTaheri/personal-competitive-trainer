import Link from "next/link";
import { weeklyReview } from "@/lib/server/review";
import { fmtDuration, fmtMinutes } from "@/lib/time";
import { RESULT_COLOR, RESULT_LABEL, SLOWED_BY } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TIP: Record<string, string> = {
  topic: "Watch the topic's NeetCode video again before your next problem in it.",
  observation: "Before coding, work 2–3 small examples by hand and look for the pattern.",
  bugs: "Check edge cases (empty input, one element, max values) before you submit.",
  misread: "Restate the problem in one line before you start thinking.",
};

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const w = Math.min(0, Math.max(-52, Number((await searchParams).w ?? 0) || 0));
  const r = weeklyReview(w);
  const maxMin = Math.max(1, ...r.days.map((d) => Math.max(d.minutes, d.goal)));
  const label = (id: string) => SLOWED_BY.find((s) => s.id === id)?.label ?? id;
  const top = r.slowed[0];
  const resolvesFaster = r.resolves.filter((x) => x.faster).length;
  const improved = r.topics.filter((t) => (t.delta ?? 0) >= 10).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const worse = r.topics.filter((t) => (t.delta ?? 0) <= -10);
  const fresh = r.topics.filter((t) => t.delta == null);
  const pct = r.goal ? Math.round((100 * r.trained) / r.goal) : 0;

  return (
    <div className="space-y-5">
      <div className="card card-pad flex flex-wrap items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-black">Weekly review</h1>
          <p className="text-mute">{fmtDay(r.start)} – {fmtDay(r.end)}{r.isCurrent ? " · this week so far" : ""}</p>
        </div>
        <Link href={`/review?w=${w - 1}`} className="btn">← Previous week</Link>
        {w < 0 && <Link href={`/review?w=${w + 1}`} className="btn">Next week →</Link>}
      </div>

      {!r.total && !r.trained ? (
        <div className="card card-pad py-16 text-center text-mute">No training this week{r.isCurrent ? " yet" : ""}. Press TRAIN NOW and it will show up here.</div>
      ) : (
        <>
          {/* headline numbers */}
          <div className="grid gap-4 md:grid-cols-4">
            <Big label="Trained" value={fmtMinutes(r.trained)} sub={`of ${fmtMinutes(r.goal)} goal · ${pct}%`} color={pct >= 100 ? "#22c55e" : "#ff7a1a"} />
            <Big label="Goal days hit" value={`${r.daysHit} / ${r.days.filter((d) => !d.future).length}`} sub="days you reached the goal" />
            <Big label="Problems" value={String(r.total)} sub={`${r.newCount} new · ${r.total - r.newCount} re-solves`} />
            <Big label="Solved alone" value={r.total ? `${Math.round((100 * (r.results.solved ?? 0)) / r.total)}%` : "—"} sub="of everything you tried" color="#22c55e" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* hours vs goal */}
            <Card title="Hours vs goal">
              <div className="flex h-44 items-end gap-3">
                {r.days.map((d) => (
                  <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div className="text-xs tabular-nums text-mute">{d.future ? "" : fmtMinutes(d.minutes)}</div>
                    <div className="relative w-full flex-1">
                      <div className="absolute inset-x-0 border-t-2 border-dashed border-orange/50" style={{ bottom: `${(100 * d.goal) / maxMin}%` }} />
                      <div className="absolute inset-x-1 bottom-0 rounded-t-lg" style={{ height: `${(100 * d.minutes) / maxMin}%`, background: d.minutes >= d.goal ? "#22c55e" : "#ff7a1a", opacity: d.future ? 0.2 : 1 }} />
                    </div>
                    <div className="text-xs text-mute">{fmtDay(d.date).split(",")[0].split(" ")[0]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-dim">Dashed line = that day&apos;s goal (halved on days you joined a contest).</div>
            </Card>

            {/* results */}
            <Card title="Results">
              <div className="flex h-5 overflow-hidden rounded-full bg-line">
                {(["solved", "solved_help", "gave_up"] as const).map((k) => <div key={k} style={{ width: `${(100 * (r.results[k] ?? 0)) / Math.max(1, r.total)}%`, background: RESULT_COLOR[k] }} />)}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(["solved", "solved_help", "gave_up"] as const).map((k) => (
                  <div key={k} className="rounded-2xl bg-panel2 p-3 text-center">
                    <div className="text-3xl font-black" style={{ color: RESULT_COLOR[k] }}>{r.results[k] ?? 0}</div>
                    <div className="text-sm text-mute">{k === "solved" ? "Solved alone" : RESULT_LABEL[k]}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* topics */}
            <Card title="Topics: this week vs the 4 weeks before">
              {!r.topics.length ? <Empty /> : (
                <div className="grid gap-4 md:grid-cols-2">
                  <TopicList title="📈 Got better" color="#22c55e" items={improved} empty="No big jumps yet." />
                  <TopicList title="📉 Got worse" color="#ef4444" items={worse} empty="Nothing dropped. Nice." />
                  {fresh.length > 0 && <div className="md:col-span-2 text-sm text-mute">New this week: {fresh.map((t) => `${t.name} (${t.score})`).join(", ")}</div>}
                  <div className="md:col-span-2 text-xs text-dim">Score = average result on that topic (alone 100, with help 50, gave up 0; lower if it felt hard or was slow). Changes of 10+ points are listed.</div>
                </div>
              )}
            </Card>

            {/* slowed by */}
            <Card title="What slowed you down">
              {!r.slowed.length ? <div className="text-sm text-mute">You didn&apos;t tick any reasons this week.</div> : (
                <>
                  <div className="space-y-2">
                    {r.slowed.map(([id, n]) => (
                      <div key={id} className="flex items-center gap-3">
                        <span className="w-48 text-sm">{label(id)}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-orange" style={{ width: `${(100 * n) / r.slowed[0][1]}%` }} /></div>
                        <span className="w-8 text-right font-mono text-sm">{n}×</span>
                      </div>
                    ))}
                  </div>
                  {top && <div className="mt-4 rounded-2xl border border-orange/40 bg-orange-soft p-3 text-sm"><b className="text-orange">Next week:</b> &ldquo;{label(top[0])}&rdquo; came up most ({top[1]}×). {TIP[top[0]] ?? ""}</div>}
                </>
              )}
            </Card>

            {/* re-solves */}
            <Card title={`Re-solves · ${resolvesFaster} of ${r.resolves.length} faster than last time`}>
              {!r.resolves.length ? <div className="text-sm text-mute">No re-solves this week.</div> : (
                <div className="space-y-2">
                  {r.resolves.map((x, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-panel2 px-3 py-2 text-sm">
                      <a href={x.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-orange">{x.title}</a>
                      <span className="text-mute tabular-nums">{x.prevSec != null ? fmtDuration(x.prevSec) : "—"} → <b className="text-ink">{fmtDuration(x.nowSec)}</b></span>
                      <span className="w-20 text-right" style={{ color: RESULT_COLOR[x.result ?? ""] }}>{x.faster ? "⚡ faster" : "slower"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* expected times */}
            <Card title="Your expected times">
              <p className="mb-3 text-sm text-mute">Used to judge &ldquo;slow&rdquo; and to size the day. Once a band has 5 solves, your own median replaces the default.</p>
              {!r.times.length ? <Empty /> : (
                <table className="tbl"><thead><tr><th>Band</th><th>Default</th><th>Yours</th><th>Solves</th></tr></thead><tbody>
                  {r.times.map((t) => (
                    <tr key={t.band}><td>{t.band}</td><td className="text-mute">{t.def} min</td><td className={t.minutes ? "font-semibold text-green" : "text-dim"}>{t.minutes ? `${t.minutes} min` : `needs ${5 - t.samples} more`}</td><td className="text-mute">{t.samples}</td></tr>
                  ))}
                </tbody></table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Big({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card card-pad">
      <div className="text-sm text-mute">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums" style={{ color }}>{value}</div>
      <div className="text-xs text-dim">{sub}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card card-pad"><div className="mb-3 font-semibold">{title}</div>{children}</div>;
}

function Empty() {
  return <div className="text-sm text-mute">Finish a few problems to see this.</div>;
}

function TopicList({ title, color, items, empty }: { title: string; color: string; items: { id: string; name: string; score: number; prev: number | null; delta: number | null }[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold" style={{ color }}>{title}</div>
      {!items.length ? <div className="text-sm text-dim">{empty}</div> : items.map((t) => (
        <div key={t.id} className="mb-1.5 flex items-center justify-between rounded-xl bg-panel2 px-3 py-1.5 text-sm">
          <span className="truncate">{t.name}</span>
          <span className="font-mono tabular-nums"><span className="text-mute">{t.prev} →</span> <b style={{ color }}>{t.score}</b></span>
        </div>
      ))}
    </div>
  );
}
