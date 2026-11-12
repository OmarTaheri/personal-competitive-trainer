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
    <div className="shrink-0 rounded-[1.5rem] border border-line bg-[#101016] p-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Upcoming contests</div>
        <Link href="/calendar" className="text-sm text-mute hover:text-orange">Calendar →</Link>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-2">
        {days.map((d, i) => {
          const k = dayKey(d, tz);
          const cs = contests.filter((c) => dayKey(c.startUtc, tz) === k);
          const date = new Date(d);
          return (
            <button key={i} onClick={() => setSel(i)} className={`flex flex-col items-center rounded-2xl py-1.5 transition ${sel === i ? "bg-orange text-black" : "bg-panel2 hover:bg-[#25252d]"}`}>
              <span className={`text-xs ${sel === i ? "text-black/70" : "text-mute"}`}>{date.toLocaleDateString(undefined, { weekday: "short", timeZone: tz })}</span>
              <span className="text-lg font-bold">{date.toLocaleDateString(undefined, { day: "numeric", timeZone: tz })}</span>
              <span className="mt-1 flex h-1.5 gap-0.5">
                {cs.slice(0, 3).map((c) => <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ background: sel === i ? "#000" : PLATFORM_META[c.platform]?.color }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        {!list.length && <div className="text-sm text-dim">No contests that day{contests.length ? " — next ones:" : "."}</div>}
        {upcoming.map((c) => {
          const m = PLATFORM_META[c.platform];
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-2">
              <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-black" style={{ background: m?.color }}>{m?.short}</span>
              <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-orange">{c.name}</a>
              <span className="text-sm tabular-nums text-mute">
                {new Date(c.startUtc).toLocaleString(undefined, { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <button onClick={() => toggle(c)} title="Joining = reminders + smaller goal that day" className={`chip !text-xs ${c.joined ? "!border-green/60 !bg-green-soft text-green" : "hover:!border-orange/60"}`}>{c.joined ? "✓ I'm joining" : "+ I'll join"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
