import Link from "next/link";
import Character from "@/components/Character";
import { UNLOCKS } from "@/lib/character";
import TrainingChart from "@/components/TrainingChart";
import ContestStrip from "@/components/ContestStrip";
import { Ring } from "@/components/HeaderBar";
import { homeData } from "@/lib/server/home";
import { fmtMinutes } from "@/lib/time";
import { TRACK_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** Home fits one screen: no page scroll. */
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

  return (
    <div className="grid h-full min-h-0 gap-5 overflow-hidden lg:grid-cols-[minmax(340px,0.85fr)_1.6fr]">
      {/* Left: you, the character */}
      <div className="card flex min-h-0 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black xl:text-3xl">{greet}, {d.name}! 👋</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="chip !text-xs">🏅 LV {st.level.level}</span>
              <span className="chip !text-xs">🔥 {st.streak} day streak</span>
              {d.cfRating && <span className="chip !text-xs">CF {d.cfRating}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-mute">XP</div>
            <div className="font-mono text-xl font-bold text-green">{st.xp.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid-bg relative mt-3 min-h-0 flex-1 rounded-3xl border border-line p-3">
          <Character level={st.level.level} cfRating={d.cfRating} groups={d.groups} className="h-full" />
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-green" />Strong</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-orange" />Learning</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red" />Weak</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#4b5563]" />Not yet</span>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-sm"><span className="text-mute">Level {st.level.level} → {st.level.level + 1}</span><span className="tabular-nums">{st.level.cur} / {st.level.need} XP</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-orange to-green" style={{ width: `${(100 * st.level.cur) / st.level.need}%` }} /></div>
          {nextUnlock && <div className="mt-1.5 text-xs text-mute">Next unlock at LV {nextUnlock.level}: <span className="text-ink">{nextUnlock.item}</span></div>}
        </div>

        <div className="mt-3">
          <div className="mb-1.5 text-sm font-semibold">Weak spots · getting extra practice</div>
          {spots.length ? (
            <div className="grid gap-1.5">
              {spots.map((w) => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl bg-panel2 px-3 py-1.5 text-sm">
                  <span className={`h-2 w-2 rounded-full ${w.weak ? "bg-red" : "bg-orange"}`} />
                  <span className="flex-1 truncate">{w.name}</span>
                  <span className="text-xs text-mute">{w.attempts} tries</span>
                  <span className="w-8 text-right font-mono font-bold" style={{ color: w.weak ? "#ef4444" : "#ff7a1a" }}>{Math.round(w.score * 100)}</span>
                </div>
              ))}
            </div>
          ) : <div className="rounded-xl bg-panel2 px-3 py-2 text-sm text-mute">Solve a few problems and your weak topics show up here.</div>}
        </div>
      </div>

      {/* Right */}
      <div className="flex min-h-0 flex-col gap-5">
        <ContestStrip contests={d.contests} tz={d.timezone} />

        <div className="grid shrink-0 gap-5 md:grid-cols-[1.5fr_1fr]">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-lg font-semibold">Today</div>
                {sunday && <Link href="/review" className="chip !border-green/50 !text-xs text-green hover:!bg-green-soft">📅 Weekly review ready</Link>}
              </div>
              <Link href="/train?suggestions=1" className="text-sm text-mute hover:text-orange">See today&apos;s suggestions →</Link>
            </div>
            <div className="mt-3 flex items-center gap-5">
              <div className="relative shrink-0">
                <Ring value={st.minutesToday} max={st.goalMin} size={96} stroke={10} color="#ff7a1a" />
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div><div className="text-lg font-black">{Math.min(100, Math.round((100 * st.minutesToday) / Math.max(1, st.goalMin)))}%</div><div className="text-[10px] text-mute">of goal</div></div>
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-3xl font-black tabular-nums">{fmtMinutes(st.minutesToday)} <span className="text-base font-normal text-mute">/ {fmtMinutes(st.goalMin)}</span></div>
                <div className="text-sm text-mute">{d.queueLeft} suggested next · ~{fmtMinutes(d.queueMin)} · adapts after each problem</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.byTrack).map(([t, n]) => <span key={t} className="chip !text-xs">{TRACK_LABEL[t] ?? t} × {n}</span>)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Progress label="NeetCode 250" v={d.neetcode.solved} max={d.neetcode.total} color="#ff7a1a" />
              <Progress label="CSES main" v={d.cses.solved} max={d.cses.total} color="#22c55e" />
              <div>
                <div className="text-xs text-mute">CF window</div>
                <div className="font-mono text-sm">{d.cfWindow} – {d.cfWindow + 200}</div>
              </div>
            </div>
          </div>

          <div className={`relative flex flex-col justify-between overflow-hidden rounded-[1.5rem] p-5 ${goalDone ? "bg-green text-black" : "bg-orange text-black"}`}>
            <div>
              <div className="text-3xl">{goalDone ? "🏆" : "⚡"}</div>
              <div className="mt-1 text-2xl font-black leading-tight xl:text-3xl">{goalDone ? "Goal smashed!" : st.active ? "Back to it!" : "Train now!"}</div>
              <div className="mt-1 text-sm text-black/75">
                {goalDone ? "Today's goal is done. Extra problems are bonus XP." : st.active ? `You're in the middle of ${st.active.title}.` : `${fmtMinutes(goalLeft)} left to hit today's goal.`}
              </div>
            </div>
            <Link href="/train" className={`mt-4 block rounded-2xl border-2 border-black/80 py-3.5 text-center text-2xl font-black transition hover:bg-black hover:text-orange ${goalDone ? "" : "pulse-glow"}`}>
              {goalDone ? "Keep going →" : st.active ? "Continue ▶" : "TRAIN NOW ▶"}
            </Link>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <TrainingChart series={d.series} goal={st.goalMin} />
        </div>
      </div>
    </div>
  );
}

function Progress({ label, v, max, color }: { label: string; v: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-mute">{label}</span><span className="tabular-nums">{v} / {max}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(100 * v) / Math.max(1, max)}%`, background: color }} /></div>
    </div>
  );
}
