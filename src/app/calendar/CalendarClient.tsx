"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalEvent } from "@/lib/server/calendar";
import { api, PLATFORM_META, refreshHeader, RESULT_LABEL } from "@/lib/ui";

type View = "day" | "week" | "month" | "list";
const HOUR_PX = 56;

/** Date helpers in the chosen time zone. Dates are YYYY-MM-DD strings. */
function partsIn(ms: number, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: Number(g("hour")) * 60 + Number(g("minute")), weekday: g("weekday") };
}
const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = (d: string) => (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
const fmtHM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const monthName = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

function colorOf(e: CalEvent) {
  return e.kind === "training" ? "#2e9d57" : PLATFORM_META[e.platform]?.color ?? "#6b6f76";
}

export default function CalendarClient({ tz: tz0, initial, initialRange }: { tz: string; initial: CalEvent[]; initialRange: [number, number] }) {
  const [tz, setTz] = useState(tz0);
  const [view, setView] = useState<View>("week");
  const today = partsIn(Date.now(), tz).date;
  const [anchor, setAnchor] = useState(today);
  const [events, setEvents] = useState(initial);
  const [range, setRange] = useState(initialRange);
  const [sel, setSel] = useState<CalEvent | null>(null);
  const [showTraining, setShowTraining] = useState(true);
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(Object.keys(PLATFORM_META)));
  const scroller = useRef<HTMLDivElement>(null);

  // Fetch more when navigating outside the loaded range.
  useEffect(() => {
    const t = Date.parse(anchor + "T00:00:00Z");
    if (t > range[0] + 7 * 86400e3 && t < range[1] - 35 * 86400e3) return;
    const from = t - 45 * 86400e3, to = t + 60 * 86400e3;
    api<CalEvent[]>(`/api/calendar?from=${from}&to=${to}`).then((ev) => { setEvents(ev); setRange([from, to]); }).catch(() => {});
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX; }, [view]);

  const visible = events.filter((e) => (e.kind === "training" ? showTraining : platforms.has(e.platform)));

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const monday = addDays(anchor, -dow(anchor));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [anchor, view]);

  const step = (dir: number) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week" || view === "list") setAnchor(addDays(anchor, 7 * dir));
    else { const d = new Date(anchor + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + dir, 1); setAnchor(d.toISOString().slice(0, 10)); }
  };

  const toggleJoin = async (e: CalEvent) => {
    await api(`/api/contests/${e.contestId}`, { joined: !e.joined });
    setEvents((ev) => ev.map((x) => (x.id === e.id ? { ...x, joined: !x.joined } : x)));
    setSel((s) => (s && s.id === e.id ? { ...s, joined: !s.joined } : s));
    refreshHeader();
  };

  const title = view === "month" || view === "list" ? <>{monthName(anchor)}, <span className="text-mute">{anchor.slice(0, 4)}</span></> : <>{monthName(days[0])}, <span className="text-mute">{days[0].slice(0, 4)}</span></>;

  return (
    <div className="card overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex rounded-xl border border-line p-1">
          <button title="Calendar" onClick={() => setView("week")} className={`rounded-lg px-2.5 py-1.5 ${view !== "list" ? "bg-panel2 text-accent" : "text-mute"}`}>📅</button>
          <button title="List" onClick={() => setView("list")} className={`rounded-lg px-2.5 py-1.5 ${view === "list" ? "bg-panel2 text-accent" : "text-mute"}`}>☰</button>
        </div>
        <button className="btn" onClick={() => setAnchor(today)}>Today</button>
        <div className="flex">
          <button className="btn !rounded-r-none" onClick={() => step(-1)}>‹</button>
          <button className="btn !rounded-l-none !border-l-0" onClick={() => step(1)}>›</button>
        </div>
        <div className="mx-auto text-2xl font-semibold">{title}</div>
        <div className="flex rounded-xl border border-line p-1">
          {(["day", "week", "month"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 capitalize ${view === v ? "bg-accent font-semibold text-white" : "text-mute hover:text-ink"}`}>{v}</button>
          ))}
        </div>
        <select className="input !w-auto" value={tz} onChange={(e) => setTz(e.target.value)} title="Time zone (default from Settings)">
          {[...new Set([tz0, "Asia/Bangkok", "UTC", "Europe/London", "America/New_York", "Asia/Tokyo", Intl.DateTimeFormat().resolvedOptions().timeZone])].map((z) => <option key={z}>{z}</option>)}
        </select>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5 text-sm">
        {Object.entries(PLATFORM_META).filter(([k]) => k !== "cses").map(([k, m]) => (
          <button key={k} onClick={() => setPlatforms((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
            className={`chip ${platforms.has(k) ? "" : "opacity-40"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />{m.label}
          </button>
        ))}
        <button onClick={() => setShowTraining((x) => !x)} className={`chip ${showTraining ? "" : "opacity-40"}`}><span className="h-2 w-2 rounded-full bg-green" />My training</button>
      </div>

      {view === "month" ? (
        <MonthGrid anchor={anchor} today={today} events={visible} tz={tz} onSelect={setSel} onDay={(d) => { setAnchor(d); setView("day"); }} />
      ) : view === "list" ? (
        <ListView anchor={anchor} events={visible.filter((e) => e.kind === "contest")} tz={tz} onSelect={setSel} />
      ) : (
        <div>
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
            <div className="px-2 py-3 text-xs text-mute">{tz.split("/").pop()?.replace("_", " ")}</div>
            {days.map((d) => {
              const isToday = d === today;
              return (
                <div key={d} className={`border-l border-line py-3 text-center ${isToday ? "border-b-2 !border-b-accent" : ""}`}>
                  <span className={isToday ? "font-bold text-accent" : "text-ink"}>{Number(d.slice(8))} </span>
                  <span className={isToday ? "text-accent" : "text-mute"}>{new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
                </div>
              );
            })}
          </div>
          <div ref={scroller} className="relative h-[68vh] overflow-y-auto scroll-thin">
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)`, height: 24 * HOUR_PX }}>
              <div className="relative">
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="absolute right-2 -translate-y-2 text-xs text-mute" style={{ top: h * HOUR_PX }}>{h ? `${h}:00` : ""}</div>)}
              </div>
              {days.map((d) => <DayColumn key={d} date={d} isToday={d === today} events={visible} tz={tz} onSelect={setSel} />)}
            </div>
          </div>
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20" onClick={() => setSel(null)}>
          <div className="card card-pad w-[26rem]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: colorOf(sel) }} />
              <span className="text-sm text-mute">{sel.kind === "training" ? "Training session" : PLATFORM_META[sel.platform]?.label}</span>
            </div>
            <div className="mt-2 text-xl font-bold">{sel.title}</div>
            <div className="mt-1 text-mute">
              {new Date(sel.start).toLocaleString(undefined, { timeZone: tz, weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} – {new Date(sel.end).toLocaleTimeString(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit" })}
            </div>
            {sel.result && <div className="mt-1">{RESULT_LABEL[sel.result]}</div>}
            <div className="mt-4 flex gap-2">
              {sel.url && <a className="btn btn-primary" href={sel.url} target="_blank" rel="noreferrer">Open ↗</a>}
              {sel.kind === "contest" && sel.end > Date.now() && (
                <button className={`btn ${sel.joined ? "!border-green/60 text-green" : ""}`} onClick={() => toggleJoin(sel)}>{sel.joined ? "✓ I'm joining" : "I'll join this"}</button>
              )}
              <button className="btn ml-auto" onClick={() => setSel(null)}>Close</button>
            </div>
            {sel.kind === "contest" && <p className="mt-3 text-xs text-dim">Mark the contests you&apos;ll actually take. Only those get reminders (1 h and 10 min before), and that day&apos;s training goal is halved. Contest problems are never added to your training.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function DayColumn({ date, isToday, events, tz, onSelect }: { date: string; isToday: boolean; events: CalEvent[]; tz: string; onSelect: (e: CalEvent) => void }) {
  const items = events
    .map((e) => {
      const s = partsIn(e.start, tz), en = partsIn(e.end, tz);
      if (s.date > date || en.date < date) return null;
      const top = s.date < date ? 0 : s.minutes;
      const bottom = en.date > date ? 24 * 60 : Math.max(en.minutes, top + 20);
      return { e, top, bottom };
    })
    .filter(Boolean) as { e: CalEvent; top: number; bottom: number }[];
  // Simple overlap layout: assign lanes.
  items.sort((a, b) => a.top - b.top);
  const lanes: number[] = [];
  const placed = items.map((it) => {
    let lane = lanes.findIndex((end) => end <= it.top);
    if (lane < 0) { lane = lanes.length; lanes.push(it.bottom); } else lanes[lane] = it.bottom;
    return { ...it, lane };
  });
  const nLanes = Math.max(1, lanes.length);
  const nowMin = isToday ? partsIn(Date.now(), tz).minutes : -1;

  return (
    <div className="relative border-l border-line">
      {Array.from({ length: 24 }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-[#f0f0ed]" style={{ top: h * HOUR_PX }} />)}
      {placed.map(({ e, top, bottom, lane }) => {
        const c = colorOf(e);
        const h = ((bottom - top) / 60) * HOUR_PX;
        return (
          <button key={e.id} onClick={() => onSelect(e)}
            className="absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs transition hover:brightness-125"
            style={{ top: (top / 60) * HOUR_PX, height: Math.max(22, h - 2), left: `calc(${(100 * lane) / nLanes}% + 2px)`, width: `calc(${100 / nLanes}% - 4px)`, background: c + "26", borderColor: c, color: "#1f2328" }}>
            <div className="truncate font-semibold" style={{ color: c }}>{e.kind === "training" ? "🏋 " : ""}{e.title}</div>
            {h > 34 && <div className="truncate text-mute">🕒 {fmtHM(top)} – {fmtHM(bottom)}</div>}
            {h > 54 && e.kind === "contest" && <div className="truncate text-mute">📍 {PLATFORM_META[e.platform]?.label}{e.joined ? " · joining ✓" : ""}</div>}
          </button>
        );
      })}
      {nowMin >= 0 && (
        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMin / 60) * HOUR_PX }}>
          <div className="relative h-0.5 bg-accent"><span className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-accent" /></div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({ anchor, today, events, tz, onSelect, onDay }: { anchor: string; today: string; events: CalEvent[]; tz: string; onSelect: (e: CalEvent) => void; onDay: (d: string) => void }) {
  const first = anchor.slice(0, 8) + "01";
  const start = addDays(first, -dow(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) { const d = partsIn(e.start, tz).date; byDay.set(d, [...(byDay.get(d) ?? []), e]); }
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line text-center text-sm text-mute">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const ev = (byDay.get(d) ?? []).sort((a, b) => a.start - b.start);
          const contests = ev.filter((e) => e.kind === "contest");
          const training = ev.filter((e) => e.kind === "training");
          const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
          return (
            <div key={d} className={`min-h-32 border-b border-l border-line p-1.5 ${inMonth ? "" : "opacity-40"}`}>
              <button onClick={() => onDay(d)} className={`mb-1 grid h-7 w-7 place-items-center rounded-full text-sm ${d === today ? "bg-accent font-bold text-white" : "hover:bg-panel2"}`}>{Number(d.slice(8))}</button>
              {contests.slice(0, 3).map((e) => (
                <button key={e.id} onClick={() => onSelect(e)} className="mb-1 block w-full truncate rounded-md border-l-2 px-1.5 py-0.5 text-left text-[11px]" style={{ background: colorOf(e) + "22", borderColor: colorOf(e) }}>
                  {new Date(e.start).toLocaleTimeString(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit" })} {e.title}
                </button>
              ))}
              {contests.length > 3 && <div className="text-[11px] text-mute">+{contests.length - 3} more</div>}
              {training.length > 0 && <div className="mt-1 text-[11px] text-green">🏋 {training.length} problem{training.length > 1 ? "s" : ""}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ anchor, events, tz, onSelect }: { anchor: string; events: CalEvent[]; tz: string; onSelect: (e: CalEvent) => void }) {
  const from = Date.parse(addDays(anchor, -1) + "T00:00:00Z");
  const list = events.filter((e) => e.end >= Math.max(from, Date.now() - 3 * 3600e3)).sort((a, b) => a.start - b.start);
  const groups = new Map<string, CalEvent[]>();
  for (const e of list) { const d = partsIn(e.start, tz).date; groups.set(d, [...(groups.get(d) ?? []), e]); }
  return (
    <div className="max-h-[75vh] overflow-y-auto p-5 scroll-thin">
      {[...groups.entries()].map(([d, evs]) => (
        <div key={d} className="mb-5">
          <div className="mb-2 text-sm font-semibold text-mute">{new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</div>
          {evs.map((e) => {
            const m = PLATFORM_META[e.platform];
            return (
              <button key={e.id} onClick={() => onSelect(e)} className="mb-2 flex w-full items-center gap-3 rounded-md border border-line bg-panel2 px-4 py-3 text-left hover:border-accent/50">
                <span className="w-24 font-mono text-accent">{new Date(e.start).toLocaleTimeString(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit" })}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: m?.color }}>{m?.short}</span>
                <span className="flex-1 truncate">{e.title}</span>
                <span className="text-sm text-mute">{Math.round((e.end - e.start) / 60000)} min</span>
                {e.joined && <span className="chip !text-xs text-green">joining</span>}
              </button>
            );
          })}
        </div>
      ))}
      {!groups.size && <div className="text-center text-dim">No upcoming contests loaded. Sync contests in Settings.</div>}
    </div>
  );
}
