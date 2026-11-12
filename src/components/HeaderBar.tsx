"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Status } from "@/lib/server/status";
import { PLATFORM_META } from "@/lib/ui";
import { fmtDuration, fmtMinutes } from "@/lib/time";

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function countdown(ms: number): string {
  if (ms <= 0) return "live now";
  const d = Math.floor(ms / 86400e3), h = Math.floor((ms % 86400e3) / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function Ring({ value, max, size = 40, stroke = 5, color = "#22c55e" }: { value: number; max: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const f = Math.min(1, max ? value / max : 0);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#26262e" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={f >= 1 ? "#22c55e" : color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - f)} strokeLinecap="round" />
    </svg>
  );
}

export default function HeaderBar({ initial }: { initial: Status }) {
  const [st, setSt] = useState(initial);
  const now = useNow();

  useEffect(() => {
    const load = () => fetch("/api/status", { cache: "no-store" }).then((r) => r.json()).then(setSt).catch(() => {});
    load(); // the layout's snapshot can be stale after leaving /train (e.g. Quit paused the timer)
    const t = setInterval(load, 30000);
    window.addEventListener("cp:refresh", load);
    window.addEventListener("focus", load);
    return () => { clearInterval(t); window.removeEventListener("cp:refresh", load); window.removeEventListener("focus", load); };
  }, []);

  const a = st.active;
  const activeSec = a ? a.baseSec + (a.phaseStartedAt ? Math.max(0, (now - a.phaseStartedAt) / 1000) : 0) : 0;
  const liveMin = st.minutesToday + (a?.phaseStartedAt ? Math.max(0, (now - a.phaseStartedAt) / 60000) : 0);
  const nc = st.nextContest;
  const meta = nc ? PLATFORM_META[nc.platform] : null;

  return (
    <header className="z-30 flex shrink-0 items-center gap-3 border-b border-line bg-bg/90 px-6 py-3 backdrop-blur">
      {a ? (
        <Link href="/train" title="Back to training" className="flex items-center gap-2 rounded-2xl border border-orange/50 bg-orange-soft px-3 py-1.5 transition hover:border-orange">
          <span className={`h-2.5 w-2.5 rounded-full ${a.phaseStartedAt ? "bg-orange animate-pulse" : "bg-dim"}`} />
          <span className="max-w-[18rem] truncate font-semibold">{a.title}</span>
          <span className={`font-mono text-lg font-bold tabular-nums ${a.phaseStartedAt ? "text-orange" : "text-mute"}`}>{fmtDuration(activeSec)}</span>
          {a.status === "feedback" ? <span className="chip !border-green/40 text-green">feedback</span> : !a.phaseStartedAt && <span className="chip !text-xs text-mute">paused</span>}
        </Link>
      ) : (
        <Link href="/train" className="btn btn-orange !py-1.5 !text-sm">▶ Train</Link>
      )}

      <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-1.5" title="Training time today / goal">
        <Ring value={liveMin} max={st.goalMin} size={30} stroke={4} color="#ff7a1a" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tabular-nums">{fmtMinutes(liveMin)} <span className="text-dim">/ {fmtMinutes(st.goalMin)}</span></div>
          <div className="text-[11px] text-mute">today</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-panel px-3 py-1.5 text-sm" title="Days in a row with 15+ minutes">
        <span>🔥</span><b className="tabular-nums">{st.streak}</b><span className="text-mute">day streak</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-1.5 text-sm" title={`${st.xp} XP`}>
        <span className="font-bold text-green">LV {st.level.level}</span>
        <div className="h-1.5 w-20 overflow-hidden rounded bg-line"><div className="h-full bg-green" style={{ width: `${(100 * st.level.cur) / st.level.need}%` }} /></div>
      </div>

      <div className="ml-auto">
        {nc && meta ? (
          <a href={nc.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-1.5 text-sm hover:border-orange/60" title={new Date(nc.startUtc).toLocaleString(undefined, { timeZone: st.timezone })}>
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-black" style={{ background: meta.color }}>{meta.short}</span>
            <span className="max-w-[16rem] truncate">{nc.name}</span>
            <span className="font-mono font-semibold tabular-nums text-orange">{countdown(nc.startUtc - now)}</span>
          </a>
        ) : (
          <Link href="/calendar" className="text-sm text-mute">No upcoming contests yet</Link>
        )}
      </div>
    </header>
  );
}
