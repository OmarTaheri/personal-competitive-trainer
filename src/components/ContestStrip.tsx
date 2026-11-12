"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Contest } from "@/db/schema";
import { PLATFORM_META, api, refreshHeader } from "@/lib/ui";

function dayKey(ms: number, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export default function ContestStrip({ contests: initial, tz }: { contests: Contest[]; tz: string }) {
  const [contests, setContests] = useState(initial);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => Date.now() + i * 86400e3), []);
  const [sel, setSel] = useState(0);
  const selKey = dayKey(days[sel], tz);
  const list = contests.filter((c) => dayKey(c.startUtc, tz) === selKey);
  const upcoming = (list.length ? list : contests).slice(0, 2);

  const toggle = async (c: Contest) => {
    await api(`/api/contests/${c.id}`, { joined: !c.joined });
    setContests((cs) => cs.map((x) => (x.id === c.id ? { ...x, joined: !x.joined } : x)));
    refreshHeader();
  };

  return (
    <div className="shrink-0 card p-4">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Upcoming contests</div>
        <Link href="/calendar" className="text-sm text-mute hover:text-accent">Calendar →</Link>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1">
        {days.map((d, i) => {
          const k = dayKey(d, tz);
          const cs = contests.filter((c) => dayKey(c.startUtc, tz) === k);
          const date = new Date(d);
          return (
            <button key={i} onClick={() => setSel(i)} className={`flex flex-col items-center rounded-md py-1 transition ${sel === i ? "bg-accent text-[#10243a]" : "hover:bg-panel2"}`}>
              <span className={`text-xs ${sel === i ? "text-[#10243a]/75" : "text-mute"}`}>{date.toLocaleDateString(undefined, { weekday: "short", timeZone: tz })}</span>
              <span className="num text-base font-semibold">{date.toLocaleDateString(undefined, { day: "numeric", timeZone: tz })}</span>
              <span className="mt-1 flex h-1.5 gap-0.5">
                {cs.slice(0, 3).map((c) => <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: sel === i ? "#fff" : PLATFORM_META[c.platform]?.color }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-1.5">
        {!list.length && <div className="text-sm text-dim">No contests that day{contests.length ? " — next ones:" : "."}</div>}
        {upcoming.map((c) => {
          const m = PLATFORM_META[c.platform];
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-md border border-line px-3 py-1.5 text-sm">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: m?.color }}>{m?.short}</span>
              <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-accent">{c.name}</a>
              <span className="num text-xs text-mute">
                {new Date(c.startUtc).toLocaleString(undefined, { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <button onClick={() => toggle(c)} title="Joining = reminders + smaller goal that day" className={`chip !text-xs ${c.joined ? "!border-green/60 !bg-green-soft text-green" : "hover:!border-accent/60"}`}>{c.joined ? "✓ I'm joining" : "+ I'll join"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
