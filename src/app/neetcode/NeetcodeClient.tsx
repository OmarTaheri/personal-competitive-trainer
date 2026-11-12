"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, diffColor, RESULT_COLOR, RESULT_LABEL } from "@/lib/ui";
import { TrainThis } from "@/components/RowActions";
import { NEETCODE_TREE, NODE_H, NODE_W, TREE_H, TREE_W } from "@/lib/neetcodeTree";

export type NcItem = { id: number; pos: number; title: string; url: string; difficulty: string | null; solved: boolean; last: string | null | undefined };
export type NcTopic = { name: string; items: NcItem[] };

const GREEN = "#22c55e", ORANGE = "#ff7a1a";

export default function NeetcodeClient({ topics, nextId }: { topics: NcTopic[]; nextId: number | null }) {
  const [view, setView] = useState<"tree" | "list">("tree");
  const [solved, setSolved] = useState<Record<number, boolean>>(() => Object.fromEntries(topics.flatMap((t) => t.items.map((i) => [i.id, i.solved]))));
  useEffect(() => { const v = localStorage.getItem("nc-view"); if (v === "list" || v === "tree") setView(v); }, []);
  const pick = (v: "tree" | "list") => { setView(v); localStorage.setItem("nc-view", v); };

  const toggle = async (id: number) => {
    const next = !solved[id];
    await api(`/api/problems/${id}`, { solved: next });
    setSolved((s) => ({ ...s, [id]: next }));
  };

  const all = topics.flatMap((t) => t.items);
  const done = all.filter((i) => solved[i.id]).length;
  const byDiff = (d: string) => ({ total: all.filter((i) => i.difficulty === d).length, solved: all.filter((i) => i.difficulty === d && solved[i.id]).length });

  return (
    <div className="space-y-5">
      <div className="card card-pad flex flex-wrap items-center gap-8">
        <div>
          <h1 className="text-3xl font-black">NeetCode 250</h1>
          <p className="text-mute">Main track · served in this order · links open LeetCode</p>
        </div>
        <div className="min-w-48 flex-1">
          <div className="flex justify-between text-sm"><span className="text-mute">Overall</span><span className="font-mono">{done} / {all.length}</span></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-orange to-green" style={{ width: `${(100 * done) / Math.max(1, all.length)}%` }} /></div>
        </div>
        {(["Easy", "Medium", "Hard"] as const).map((d) => { const s = byDiff(d); return <div key={d} className="text-center"><div className="text-sm" style={{ color: diffColor(d) }}>{d}</div><div className="font-mono text-xl font-bold">{s.solved}/{s.total}</div></div>; })}
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {(["tree", "list"] as const).map((v) => (
            <button key={v} onClick={() => pick(v)} className={`rounded-lg px-4 py-1.5 text-sm capitalize ${view === v ? "bg-orange font-semibold text-black" : "text-mute hover:text-ink"}`}>{v === "tree" ? "🌳 Tree" : "☰ List"}</button>
          ))}
        </div>
      </div>

      {view === "tree"
        ? <TreeView topics={topics} solved={solved} nextId={nextId} toggle={toggle} />
        : <ListView topics={topics} solved={solved} nextId={nextId} toggle={toggle} />}
    </div>
  );
}

// ----------------------------------------------------------------------------- tree

function TreeView({ topics, solved, nextId, toggle }: { topics: NcTopic[]; solved: Record<number, boolean>; nextId: number | null; toggle: (id: number) => void }) {
  const byName = useMemo(() => new Map(topics.map((t) => [t.name, t])), [topics]);
  const nextTopic = topics.find((t) => t.items.some((i) => i.id === nextId))?.name ?? null;
  const [sel, setSel] = useState<string | null>(nextTopic ?? topics[0]?.name ?? null);
  const stat = (name: string) => {
    const t = byName.get(name);
    const total = t?.items.length ?? 0, n = t?.items.filter((i) => solved[i.id]).length ?? 0;
    return { total, n, complete: total > 0 && n === total };
  };
  const pos = new Map(NEETCODE_TREE.map((n) => [n.topic, n]));
  const missing = (name: string) => (pos.get(name)?.parents ?? []).filter((p) => !stat(p).complete);
  const selTopic = sel ? byName.get(sel) : undefined;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
      <div className="card grid-bg overflow-hidden p-4">
        <div className="mb-2 flex flex-wrap items-center gap-4 px-2 text-xs text-mute">
          <span>Arrows point to what comes next. Finish a topic&apos;s prerequisites first.</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-green" />done</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-orange" />in progress</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-dashed border-dim" />do prerequisites first</span>
        </div>
        <svg viewBox={`0 0 ${TREE_W} ${TREE_H}`} className="h-auto w-full">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#4b5563" />
            </marker>
            <marker id="arrowOn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={GREEN} />
            </marker>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {/* edges */}
          {NEETCODE_TREE.flatMap((n) => n.parents.map((p) => {
            const a = pos.get(p)!;
            const x1 = a.x, y1 = a.y + NODE_H / 2, x2 = n.x, y2 = n.y - NODE_H / 2 - 3;
            const my = (y1 + y2) / 2;
            const on = stat(p).complete;
            return <path key={`${p}-${n.topic}`} d={`M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`} fill="none" stroke={on ? GREEN : "#3a3a44"} strokeWidth={on ? 2.5 : 2} markerEnd={on ? "url(#arrowOn)" : "url(#arrow)"} opacity={on ? 0.9 : 1} />;
          }))}
          {/* nodes */}
          {NEETCODE_TREE.map((n) => {
            const s = stat(n.topic);
            const locked = missing(n.topic).length > 0 && s.n === 0;
            const color = s.complete ? GREEN : s.n > 0 ? ORANGE : "#6b7280";
            const isNext = n.topic === nextTopic, isSel = n.topic === sel;
            const x = n.x - NODE_W / 2, y = n.y - NODE_H / 2;
            return (
              <g key={n.topic} onClick={() => setSel(n.topic)} className="cursor-pointer" opacity={locked ? 0.55 : 1}>
                {isNext && <rect x={x - 4} y={y - 4} width={NODE_W + 8} height={NODE_H + 8} rx={18} fill={ORANGE} opacity={0.45} filter="url(#glow)" />}
                <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={14} fill={s.complete ? "#0f2016" : "#16161b"}
                  stroke={isSel ? "#f4f4f5" : color} strokeWidth={isSel ? 2.5 : 1.8} strokeDasharray={locked ? "6 5" : undefined} />
                <text x={n.x} y={y + 25} textAnchor="middle" fontSize="15" fontWeight="700" fill="#f4f4f5">{n.short ?? n.topic}</text>
                <rect x={x + 16} y={y + 40} width={NODE_W - 70} height={7} rx={3.5} fill="#26262e" />
                <rect x={x + 16} y={y + 40} width={(NODE_W - 70) * (s.total ? s.n / s.total : 0)} height={7} rx={3.5} fill={color} />
                <text x={x + NODE_W - 14} y={y + 48} textAnchor="end" fontSize="12" fill="#9ca3af" fontFamily="monospace">{s.n}/{s.total}</text>
                {s.complete && <text x={x + NODE_W - 12} y={y + 20} textAnchor="end" fontSize="14" fill={GREEN}>✓</text>}
                <title>{locked ? `Do first: ${missing(n.topic).join(", ")}` : n.topic}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="card flex max-h-[calc(100dvh-170px)] flex-col overflow-hidden xl:sticky xl:top-0">
        {selTopic ? (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold">{selTopic.name}</div>
                <span className="font-mono text-sm text-mute">{stat(selTopic.name).n}/{stat(selTopic.name).total}</span>
              </div>
              {missing(selTopic.name).length > 0 ? (
                <div className="mt-1 text-sm text-orange">Do first: {missing(selTopic.name).join(", ")}</div>
              ) : (
                <div className="mt-1 text-sm text-mute">
                  {(pos.get(selTopic.name)?.parents.length ?? 0) ? `Unlocked by ${pos.get(selTopic.name)!.parents.join(", ")}` : "Start here"}
                  {" · next: "}{NEETCODE_TREE.filter((x) => x.parents.includes(selTopic.name)).map((x) => x.short ?? x.topic).join(", ") || "nothing, it's a leaf"}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
              {selTopic.items.map((i) => <Row key={i.id} i={i} solved={!!solved[i.id]} next={i.id === nextId} toggle={toggle} />)}
            </div>
          </>
        ) : <div className="p-6 text-mute">Click a topic.</div>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- list

function ListView({ topics, solved, nextId, toggle }: { topics: NcTopic[]; solved: Record<number, boolean>; nextId: number | null; toggle: (id: number) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(topics.map((t) => [t.name, t.items.some((i) => i.id === nextId)])));
  // Empty space left where a closed list was, so the page can't shrink under you and jump.
  const [spacer, setSpacer] = useState(0);
  const toggleTopic = (name: string, el: HTMLElement | null) => {
    const main = document.getElementById("main");
    if (!el || !main) { setOpen((o) => ({ ...o, [name]: !o[name] })); return; }
    const before = el.getBoundingClientRect().top;
    const want = Math.max(before, main.getBoundingClientRect().top + 8); // same spot, or the top if you'd scrolled past it
    const scrollBefore = main.scrollTop;
    const closing = !!open[name];
    // Pad first, so collapsing can never clamp the scroll position.
    if (closing) setSpacer((s) => s + el.parentElement!.offsetHeight);
    setOpen((o) => ({ ...o, [name]: !o[name] }));
    requestAnimationFrame(() => {
      main.scrollTop = scrollBefore;
      main.scrollBy({ top: el.getBoundingClientRect().top - want });
    });
  };
  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {topics.map((t) => (
          <Topic key={t.name} t={t} open={!!open[t.name]} onToggle={(el) => toggleTopic(t.name, el)} solved={solved} nextId={nextId} toggle={toggle} />
        ))}
      </div>
      <div style={{ height: spacer }} onClick={() => setSpacer(0)} aria-hidden />
    </>
  );
}

function Topic({ t, open, onToggle, solved, nextId, toggle }: { t: NcTopic; open: boolean; onToggle: (el: HTMLElement | null) => void; solved: Record<number, boolean>; nextId: number | null; toggle: (id: number) => void }) {
  const head = useRef<HTMLButtonElement>(null);
  const done = t.items.filter((i) => solved[i.id]).length;
  const onClick = () => onToggle(head.current);
  return (
    <div className="card overflow-hidden">
      <button ref={head} onClick={onClick} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className={`text-mute transition ${open ? "rotate-90" : ""}`}>▸</span>
        <span className="flex-1 text-lg font-bold">{t.name}</span>
        <span className="font-mono text-sm text-mute">{done}/{t.items.length}</span>
        <div className="h-2 w-28 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(100 * done) / t.items.length}%`, background: done === t.items.length ? GREEN : ORANGE }} /></div>
      </button>
      {open && <div className="border-t border-line">{t.items.map((i) => <Row key={i.id} i={i} solved={!!solved[i.id]} next={i.id === nextId} toggle={toggle} />)}</div>}
    </div>
  );
}

function Row({ i, solved, next, toggle }: { i: NcItem; solved: boolean; next: boolean; toggle: (id: number) => void }) {
  return (
    <div className={`flex items-center gap-3 border-b border-[#1f1f26] px-5 py-2.5 last:border-0 ${next ? "bg-orange-soft" : ""}`}>
      <button title={solved ? "Marked solved, click to unmark" : "Mark as solved"} onClick={() => toggle(i.id)}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs ${solved ? "border-green bg-green text-black" : "border-line text-transparent hover:border-green/60"}`}>✓</button>
      <span className="w-8 text-right font-mono text-xs text-dim">{i.pos}</span>
      <a href={i.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-orange">{i.title}</a>
      {next && <span className="chip !text-xs text-orange">next</span>}
      {i.last !== undefined && <span className="h-2 w-2 rounded-full" title={RESULT_LABEL[i.last ?? ""]} style={{ background: RESULT_COLOR[i.last ?? ""] ?? "#6b7280" }} />}
      <span className="w-16 text-right text-xs" style={{ color: diffColor(i.difficulty) }}>{i.difficulty}</span>
      <TrainThis id={i.id} url={i.url} />
    </div>
  );
}
