"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Status } from "@/lib/server/status";
import { C, PLATFORM_META } from "@/lib/ui";
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

export function Ring({ value, max, size = 40, stroke = 5, color = C.accent }: { value: number; max: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const f = Math.min(1, max ? value / max : 0);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={f >= 1 ? C.green : color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - f)} strokeLinecap="round" />
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
    <header className="z-30 flex shrink-0 items-center gap-7 border-b border-line bg-panel px-6 py-2.5">
      {a ? (
        <Link href="/train" title="Back to training" className="flex items-center gap-2.5 rounded-md border border-accent/40 px-3 py-1 transition hover:border-accent">
          <span className={`h-2 w-2 rounded-full ${a.phaseStartedAt ? "animate-pulse bg-accent" : "bg-dim"}`} />
          <span className="max-w-[16rem] truncate text-sm font-medium">{a.title}</span>
          <span className={`num text-base font-semibold ${a.phaseStartedAt ? "text-accent" : "text-mute"}`}>{fmtDuration(activeSec)}</span>
          {a.status === "feedback" ? <span className="text-xs text-green">feedback</span> : !a.phaseStartedAt && <span className="text-xs text-mute">paused</span>}
        </Link>
      ) : (
        <Link href="/train" className="btn btn-primary !py-1.5 !text-sm">Start training</Link>
      )}

      <Metric label="Today" title="Training time today / goal">
        <span className={liveMin >= st.goalMin ? "text-green" : ""}>{fmtMinutes(liveMin)}</span>
        <span className="text-dim"> / {fmtMinutes(st.goalMin)}</span>
      </Metric>
      <Metric label="Streak" title="Days in a row with 15+ minutes">{st.streak}<span className="text-dim"> d</span></Metric>
      <Metric label={`Level ${st.level.level}`} title={`${st.xp} XP`}>
        <span className="flex items-center gap-2">
          <span className="text-sm">{st.level.cur}<span className="text-dim">/{st.level.need}</span></span>
          <span className="h-1 w-16 overflow-hidden rounded bg-line"><span className="block h-full bg-accent" style={{ width: `${(100 * st.level.cur) / st.level.need}%` }} /></span>
        </span>
      </Metric>

      <div className="ml-auto">
        {nc && meta ? (
          <a href={nc.url} target="_blank" rel="noreferrer" className="group flex items-center gap-2.5 text-sm" title={new Date(nc.startUtc).toLocaleString(undefined, { timeZone: st.timezone })}>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: meta.color }}>{meta.short}</span>
            <span className="max-w-[16rem] truncate text-mute group-hover:text-ink">{nc.name}</span>
            <span className="num font-semibold text-ink">{countdown(nc.startUtc - now)}</span>
          </a>
        ) : (
          <Link href="/calendar" className="text-sm text-mute hover:text-accent">No upcoming contests yet</Link>
        )}
      </div>
    </header>
  );
}

function Metric({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div title={title} className="leading-tight">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-dim">{label}</div>
      <div className="num text-base font-semibold">{children}</div>
    </div>
  );
}
