import Link from "next/link";
import Character from "@/components/Character";
import { UNLOCKS } from "@/lib/character";
import TrainingChart from "@/components/TrainingChart";
import ContestStrip from "@/components/ContestStrip";
import ConceptKeyboard from "@/components/ConceptKeyboard";
import { homeData } from "@/lib/server/home";
import { fmtMinutes } from "@/lib/time";
import { masteryInk, TRACK_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Home: a line of numbers, then your concept keyboard as the centrepiece, then small
 * cards (you, weak spots, contests) and the training chart.
 */
export default function Home() {
  const d = homeData();
  const st = d.status;
  const goalLeft = Math.max(0, st.goalMin - st.minutesToday);
  const goalDone = goalLeft <= 0;
  const nextUnlock = UNLOCKS.find((u) => u.level > st.level.level);
  const hour = new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: d.timezone });
  const greet = Number(hour) < 12 ? "Good morning" : Number(hour) < 18 ? "Good afternoon" : "Good evening";
  const spots = [...d.weak.map((w) => ({ ...w, weak: true })), ...d.learning.map((w) => ({ ...w, weak: false }))];
  const sunday = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: d.timezone }) === "Sun";
  const focus = d.keys.filter((k) => k.focus);

  return (
    <div className="mx-auto max-w-[1120px] space-y-6 pb-6">
      {/* Greeting + primary action */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{greet}, {d.name}</h1>
          <p className="mt-0.5 text-sm text-mute">
            {goalDone ? "Today's goal is done — anything more is bonus." : st.active ? `You're in the middle of ${st.active.title}.` : `${fmtMinutes(goalLeft)} left to reach today's goal.`}
            {" "}{d.queueLeft} suggested next (~{fmtMinutes(d.queueMin)}), adapts after each problem.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sunday && <Link href="/review" className="text-sm text-green hover:underline">Weekly review ready →</Link>}
          <Link href="/train?suggestions=1" className="btn">Today&apos;s suggestions</Link>
          <Link href="/train" className="btn btn-primary !px-5">{st.active ? "Continue training →" : "Start training →"}</Link>
        </div>
      </div>

      {/* The metrics line */}
      <div className="card grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Metric label="Today" value={fmtMinutes(st.minutesToday)} sub={`of ${fmtMinutes(st.goalMin)}`} bar={st.minutesToday / Math.max(1, st.goalMin)} />
        <Metric label="Streak" value={`${st.streak}`} sub="days" />
        <Metric label="Solved alone" value={d.solvedAlonePct == null ? "–" : `${d.solvedAlonePct}%`} sub="of attempts" />
        <Metric label="CF window" value={`${d.cfWindow}`} sub={d.cfRating ? `rating ${d.cfRating}` : `to ${d.cfWindow + 200}`} />
        <Metric label="NeetCode 250" value={`${d.neetcode.solved}`} sub={`/ ${d.neetcode.total}`} bar={d.neetcode.solved / Math.max(1, d.neetcode.total)} />
        <Metric label="CSES" value={`${d.cses.solved}`} sub={`/ ${d.cses.total}`} bar={d.cses.solved / Math.max(1, d.cses.total)} />
      </div>

      {/* The keyboard */}
      <section className="card px-6 pb-5 pt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="eyebrow">Concepts</div>
          <div className="text-xs text-mute">
            {focus.length ? <>Focus today: {focus.map((k) => <span key={k.id} className="ml-1.5 font-medium text-accent">{k.name}</span>)}</> : "No focus concepts today — the plan mixes everything."}
          </div>
        </div>
        <ConceptKeyboard keys={d.keys} size="lg" />
      </section>

      {/* Small cards */}
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1fr_1.35fr]">
        <div className="card flex gap-4 p-4">
          <div className="h-[200px] w-[120px] shrink-0">
            <Character level={st.level.level} cfRating={d.cfRating} groups={d.groups} className="h-full" info={false} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            <div>
              <div className="eyebrow">Level</div>
              <div className="num text-3xl font-semibold">{st.level.level}</div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-mute"><span>XP</span><span className="num">{st.level.cur} / {st.level.need}</span></div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-line"><div className="h-full bg-accent" style={{ width: `${(100 * st.level.cur) / st.level.need}%` }} /></div>
            </div>
            <div className="num text-xs text-mute">{st.xp.toLocaleString()} XP total</div>
            {nextUnlock && <div className="text-xs text-mute">Next at LV {nextUnlock.level}: <span className="text-ink">{nextUnlock.item}</span></div>}
          </div>
        </div>

        <div className="card p-4">
          <div className="eyebrow">Weak spots · extra practice</div>
          {spots.length ? (
            <div className="mt-2 divide-y divide-line">
              {spots.map((w) => (
                <Link key={w.id} href={`/problems?concept=${w.id}&status=unsolved`} className="flex items-center gap-3 py-2 text-sm hover:text-accent">
                  <span className="h-2 w-2 rounded-full" style={{ background: masteryInk(w.score, w.attempts) }} />
                  <span className="flex-1 truncate">{w.name}</span>
                  <span className="text-xs text-dim">{w.attempts} {w.attempts === 1 ? "try" : "tries"}</span>
                  <span className="num w-8 text-right font-semibold" style={{ color: masteryInk(w.score, w.attempts) }}>{Math.round(w.score * 100)}</span>
                </Link>
              ))}
            </div>
          ) : <div className="mt-2 text-sm text-mute">Solve a few problems and your weak topics show up here.</div>}
          {Object.keys(d.byTrack).length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="eyebrow">Up next</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.entries(d.byTrack).map(([t, n]) => <span key={t} className="chip !text-xs">{TRACK_LABEL[t] ?? t} <span className="num text-mute">×{n}</span></span>)}
              </div>
            </div>
          )}
        </div>

        <ContestStrip contests={d.contests} tz={d.timezone} />
      </div>

      <div className="h-[260px]">
        <TrainingChart series={d.series} goal={st.goalMin} />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: number }) {
  return (
    <div className="px-5 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="num text-2xl font-semibold">{value}</span>
        {sub && <span className="text-xs text-mute">{sub}</span>}
      </div>
      {bar != null && <div className="mt-1.5 h-1 overflow-hidden rounded bg-line"><div className={`h-full ${bar >= 1 ? "bg-green" : "bg-accent"}`} style={{ width: `${Math.min(100, bar * 100)}%` }} /></div>}
    </div>
  );
}
