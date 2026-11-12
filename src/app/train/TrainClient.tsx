"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrainView, HelpContent, Suggestion } from "@/lib/server/trainView";
import { api, C, diffColor, masteryColor, PLATFORM_META, refreshHeader, RESULT_COLOR, RESULT_LABEL, SLOWED_BY } from "@/lib/ui";
import ConceptKeyboard from "@/components/ConceptKeyboard";
import { fmtDuration, fmtMinutes } from "@/lib/time";

type Phase = "think" | "stuck" | "code" | "paused";
const PHASE_META: Record<Phase, { label: string; color: string }> = {
  think: { label: "Thinking", color: C.accent },
  stuck: { label: "Stuck", color: C.red },
  code: { label: "Coding / debugging", color: C.green },
  paused: { label: "Paused", color: C.dim },
};

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/**
 * Focus mode: full screen, no sidebar. The problem title is the centre of the page,
 * everything else sits above and below it. Training never ends on its own: after the
 * feedback the next (re-planned) problem shows up until you press Quit.
 */
export default function TrainClient({ initial }: { initial: TrainView }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpContent[]>([]);
  const [panel, setPanel] = useState<"none" | "suggestions" | "help">("none");
  const skew = useRef(initial.serverNow - Date.now());

  const a = v.attempt;
  const running = !!a && a.status === "active" && a.phase !== "paused" && !!a.phaseStartedAt;
  const now = useTick(running) + skew.current;

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const nv = await api<TrainView>("/api/train", body);
      skew.current = nv.serverNow - Date.now();
      setV(nv);
      refreshHeader();
      return nv;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useIdlePause(running && a ? a.id : null, v.settings.idlePauseMin, (at) => act({ action: "phase", id: a!.id, phase: "paused", at }));

  useEffect(() => {
    const onFocus = () => api<TrainView>("/api/train").then((nv) => { skew.current = nv.serverNow - Date.now(); setV(nv); }).catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => { if (new URLSearchParams(window.location.search).get("suggestions")) setPanel("suggestions"); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel("none"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (!a) { setHelp([]); setPanel((p) => (p === "help" ? "none" : p)); } }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const quit = async () => {
    if (a && a.status === "active" && a.phase !== "paused") await act({ action: "phase", id: a.id, phase: "paused" });
    router.push("/");
  };

  const bonus = v.queue.doneMin >= v.queue.goalMin;
  const top = (onQuit: () => void) => (
    <TopBar doneMin={v.queue.doneMin} goalMin={v.queue.goalMin} bonus={bonus} onSuggestions={() => setPanel(panel === "suggestions" ? "none" : "suggestions")} onQuit={onQuit}
      helpCount={help.length} onHelp={() => setPanel(panel === "help" ? "none" : "help")} />
  );

  const drawers = (
    <>
      <Drawer open={panel === "suggestions"} title="Today's suggestions" onClose={() => setPanel("none")}>
        <Suggestions list={v.suggestions} />
      </Drawer>
      <Drawer open={panel === "help"} title="Help" onClose={() => setPanel("none")}>
        {help.map((h) => (
          <div key={h.kind} className="mb-5">
            <div className="eyebrow mb-2">{h.kind === "hint" ? "Hints" : "Solutions"}</div>
            {h.hints.map((t, i) => <details key={i} className="mb-2 rounded-md bg-panel2 p-3" open={i === 0}><summary className="cursor-pointer text-mute">Hint {i + 1}</summary><div className="mt-2">{t}</div></details>)}
            <div className="flex flex-wrap gap-2">{h.links.map((l) => <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
          </div>
        ))}
      </Drawer>
    </>
  );

  if (!v.problem) {
    return (
      <Screen top={top(() => router.push("/"))} drawers={drawers}>
        <h1 className="text-2xl font-semibold">Nothing left to suggest</h1>
        <p className="mt-2 max-w-xl text-mute">Import Codeforces problems in Settings → Problem bank to unlock more.</p>
      </Screen>
    );
  }

  const p = v.problem;
  const doneCount = v.suggestions.filter((s) => s.state === "done").length;
  const focus = v.keys.filter((k) => k.focus);
  const goalPct = Math.round((100 * v.queue.doneMin) / Math.max(1, v.queue.goalMin));
  const info = (extra: React.ReactNode) => (
    <InfoBlock>
      <Row label="Metrics">
        <Metric name="Today" value={fmtMinutes(v.queue.doneMin)} />
        <Metric name="Problems" value={String(doneCount)} />
        <Metric name="Left" value={`${v.queue.left}`} note={`~${fmtMinutes(v.suggestions.filter((s) => s.state !== "done").reduce((m, s) => m + s.expectedMin, 0))}`} />
      </Row>
      <Row label="All concepts">
        <ConceptKeyboard keys={v.keys} size="xs" legend={false} highlight={!a ? v.last?.concepts : undefined} />
      </Row>
      <Row label="Focus">
        {focus.length ? focus.map((k) => (
          <span key={k.id} className="mr-4 inline-flex items-center gap-2">
            <span className="rounded px-1.5 py-0.5 font-mono text-xs font-semibold text-[#e6e2e2]" style={{ background: masteryColor(k.score, k.attempts), boxShadow: `0 0 0 1px ${C.accent}` }}>{k.key}</span>
            <span>{k.name}</span>
            <span className="num text-sm text-mute">{k.attempts ? `${Math.round((k.score ?? 0) * 100)} · ${k.attempts} tries` : "new"}</span>
          </span>
        )) : <span className="text-mute">No focus concepts today, the plan mixes everything.</span>}
      </Row>
      {extra}
      <Row label="Daily goal">
        <span className="num text-sm text-mute">{goalPct}%/{v.queue.goalMin} minutes</span>
        <span className="ml-4 inline-block h-2.5 w-[min(28rem,40vw)] overflow-hidden rounded-sm border border-[#555] bg-[#2b2b2b] align-middle">
          <span className={`block h-full ${goalPct >= 100 ? "bg-green" : "bg-[#6c6666]"}`} style={{ width: `${Math.min(100, goalPct)}%` }} />
        </span>
        {goalPct >= 100 && <span className="ml-3 text-sm text-green">bonus round</span>}
      </Row>
    </InfoBlock>
  );

  // ----------------------------------------------------- next problem
  if (!a) {
    const start = () => { if (!busy) act({ action: "start", problemId: p.id }); };
    return (
      <Screen top={top(() => router.push("/"))} drawers={drawers} keys={{ " ": start, Enter: start }}>
        {info(
          <Row label="Last problem">
            {v.last ? <span>{v.last.title} <span className="text-sm text-mute">· its concepts are outlined above</span></span> : <span className="text-mute">Nothing finished yet today.</span>}
          </Row>,
        )}
        <ProblemLine p={p} label="Next problem" />
        <Pad>
          <PadRow>
            <PadKey hint="↗" label="Open problem" grow onClick={() => window.open(p.url, "_blank", "noreferrer")} />
            <PadKey hint="☰" label="Today's suggestions" grow onClick={() => setPanel("suggestions")} />
          </PadRow>
          <PadRow>
            <PadKey hint="space / enter" label="Start (starts the timer)" color={C.accent} filled grow={4} big disabled={busy} onClick={start} />
          </PadRow>
        </Pad>
        {err && <ErrorBox msg={err} />}
      </Screen>
    );
  }

  // ----------------------------------------------------- feedback
  if (a.status === "feedback") {
    return <FeedbackForm key={a.id} v={v} busy={busy} act={act} err={err} top={top} drawers={drawers} onQuitHome={() => router.push("/")} />;
  }

  // ----------------------------------------------------- solving
  const phase = a.phase as Phase;
  const runSec = running ? Math.max(0, (now - a.phaseStartedAt!) / 1000) : 0;
  const think = a.thinkSec + (phase === "think" ? runSec : 0);
  const stuck = a.stuckSec + (phase === "stuck" ? runSec : 0);
  const code = a.codeSec + (phase === "code" ? runSec : 0);
  const total = think + stuck + code;
  const overExpected = total / 60 > p.expectedMin;
  const pm = PHASE_META[phase];
  const go = (ph: Phase) => () => { if (!busy && phase !== ph) act({ action: "phase", id: a.id, phase: ph }); };
  const pauseResume = () => { if (busy) return; if (phase === "paused") act({ action: "resume", id: a.id }); else act({ action: "phase", id: a.id, phase: "paused" }); };
  const finish = (result: "solved" | "solved_help" | "gave_up") => () => { if (!busy) act({ action: "finish", id: a.id, result }); };
  const solved = finish(a.helpUsed === "none" ? "solved" : "solved_help");

  return (
    <Screen top={top(quit)} drawers={drawers}
      keys={{ t: go("think"), s: go("stuck"), c: go("code"), " ": pauseResume, "shift+Enter": solved, "shift+H": finish("solved_help"), "shift+G": finish("gave_up") }}>
      {info(
        <Row label="Phases">
          <span className="num text-sm">
            <span style={{ color: PHASE_META.think.color }}>think {fmtDuration(think)}</span>
            <span className="mx-3 text-dim">·</span>
            <span style={{ color: PHASE_META.stuck.color }}>stuck {fmtDuration(stuck)}</span>
            <span className="mx-3 text-dim">·</span>
            <span style={{ color: PHASE_META.code.color }}>code {fmtDuration(code)}</span>
            <span className="ml-4 text-mute">expected ~{p.expectedMin}m</span>
          </span>
        </Row>,
      )}
      <ProblemLine p={p} label={
        <span className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse" : ""}`} style={{ background: pm.color }} />
          <span style={{ color: pm.color }}>{pm.label}</span>
          <span className={`num text-2xl font-semibold ${overExpected ? "text-red" : "text-ink"}`}>{fmtDuration(total)}</span>
        </span>
      } />
      <Pad>
        <PadRow>
          <PadKey hint="T" label="Thinking" color={PHASE_META.think.color} active={phase === "think"} grow disabled={busy} onClick={go("think")} />
          <PadKey hint="S" label="I'm stuck" color={PHASE_META.stuck.color} active={phase === "stuck"} grow disabled={busy} onClick={go("stuck")} />
          <PadKey hint="C" label={phase === "stuck" ? "Got it, coding" : "Coding"} color={PHASE_META.code.color} active={phase === "code"} grow disabled={busy} onClick={go("code")} />
        </PadRow>
        <PadRow>
          <PadKey hint="⇧ enter" label="Solved" color={C.green} filled grow disabled={busy} onClick={solved} />
          <PadKey hint="⇧ H" label="Solved with help" color={C.amber} filled grow disabled={busy} onClick={finish("solved_help")} />
          <PadKey hint="⇧ G" label="Gave up" color={C.red} filled grow disabled={busy} onClick={finish("gave_up")} />
        </PadRow>
        <PadRow>
          <PadKey hint="space" label={phase === "paused" ? "Resume" : "Pause"} color={phase === "paused" ? C.accent : "#8b4a47"} filled grow={4} big disabled={busy} onClick={pauseResume} />
        </PadRow>
      </Pad>
      <div className="mt-3 flex justify-center gap-6 text-xs text-dim">
        <span>Auto-pauses after {v.settings.idlePauseMin} min idle.</span>
        <button className="hover:text-red" onClick={() => { if (confirmInline()) act({ action: "discard", id: a.id }); }}>Opened by mistake? Discard</button>
      </div>
      {err && <ErrorBox msg={err} />}
    </Screen>
  );
}

// ----------------------------------------------------------------------------- layout pieces

type KeyMap = Record<string, () => void>;

/** keybr-like page: info block, problem line, control pad, all in one left-aligned column. */
function Screen({ top, drawers, keys, children }: { top: React.ReactNode; drawers: React.ReactNode; keys?: KeyMap; children: React.ReactNode }) {
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const name = e.shiftKey ? `shift+${e.key.length === 1 ? e.key.toUpperCase() : e.key}` : k;
      const fn = ref.current?.[name];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div className="relative">{top}</div>
      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 pb-8 scroll-thin">
        <div className="mx-auto flex w-full max-w-5xl flex-col pt-[3vh]">{children}</div>
      </div>
      {drawers}
    </div>
  );
}

function TopBar({ doneMin, goalMin, bonus, onSuggestions, onQuit, helpCount, onHelp }: { doneMin: number; goalMin: number; bonus: boolean; onSuggestions: () => void; onQuit: () => void; helpCount: number; onHelp: () => void }) {
  return (
    <div className="flex items-center gap-4 px-6 py-3">
      <button className="btn btn-ghost !px-3 text-mute" onClick={onQuit} title="Quit training">← Quit</button>
      <span className="num text-sm text-dim">{fmtMinutes(doneMin)} / {fmtMinutes(goalMin)} today{bonus ? " · goal done" : ""}</span>
      <div className="ml-auto flex items-center gap-2">
        {helpCount > 0 && <button className="btn btn-ghost !py-1.5 !text-sm text-amber" onClick={onHelp}>Help</button>}
        <button className="btn btn-ghost !py-1.5 !text-sm text-mute" onClick={onSuggestions}>Today&apos;s suggestions</button>
      </div>
    </div>
  );
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 text-[15px]">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="self-start whitespace-nowrap pt-0.5 text-right text-ink">{label}:</div>
      <div className="min-w-0">{children}</div>
    </>
  );
}

function Metric({ name, value, note }: { name: string; value: string; note?: string }) {
  return (
    <span className="mr-6 inline-flex items-baseline gap-2">
      <span className="text-ink">{name}:</span>
      <span className="num text-sm text-mute">{value}{note && <span className="ml-1.5 text-dim">({note})</span>}</span>
    </span>
  );
}

/** The "lesson text": the problem title, big and monospace, with one quiet line of facts under it. */
function ProblemLine({ p, label }: { p: NonNullable<TrainView["problem"]>; label: React.ReactNode }) {
  const meta = PLATFORM_META[p.platform];
  return (
    <div className="mt-[5vh]">
      <div className="mb-2 text-sm text-mute">{label}</div>
      <a href={p.url} target="_blank" rel="noreferrer" title="Open in a new tab"
        className="block font-mono leading-tight tracking-tight text-ink hover:text-accent"
        style={{ fontSize: p.title.length > 40 ? "clamp(1.6rem, 3vw, 2.6rem)" : "clamp(2rem, 3.8vw, 3.2rem)" }}>
        {p.title}<span className="ml-3 align-middle text-[0.45em] text-dim">↗</span>
      </a>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-mute">
        <span style={{ color: meta.color }}>{meta.label}</span>
        <span className="text-dim">·</span>
        <span>{p.track}</span>
        <span className="text-dim">·</span>
        <span style={{ color: diffColor(p.difficulty, p.rating) }}>{p.difficulty ?? (p.rating ? `${p.rating}` : "?")}</span>
        <span className="text-dim">·</span>
        <span>~{p.expectedMin} min</span>
        {p.tags === null ? <><span className="text-dim">·</span><span className="text-dim">tags hidden (contest mode)</span></>
          : p.tags.length > 0 && <><span className="text-dim">·</span><span className="text-dim">{p.tags.slice(0, 6).join(", ")}</span></>}
      </div>
    </div>
  );
}

/** The control pad, drawn like a keyboard: rounded panel, rows of keys with their shortcut in the corner. */
function Pad({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto mt-[5vh] w-full max-w-3xl rounded-xl bg-[#2b2b2b] p-3 shadow-[0_6px_24px_#00000055]"><div className="flex flex-col gap-2">{children}</div></div>;
}
function PadRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}
function PadKey({ hint, label, color, active, filled, grow = 1, big, disabled, onClick }: {
  hint: string; label: string; color?: string; active?: boolean; filled?: boolean; grow?: number | boolean; big?: boolean; disabled?: boolean; onClick: () => void;
}) {
  const on = active || filled;
  const bg = on && color ? color : "#404040";
  return (
    <button type="button" disabled={disabled} onClick={(e) => { e.currentTarget.blur(); onClick(); }}
      className={`relative flex min-w-0 flex-col justify-end rounded-md px-3 pb-2 pt-5 text-left transition hover:brightness-110 active:translate-y-px disabled:opacity-50 ${big ? "h-16" : "h-[4.2rem]"}`}
      style={{ flexGrow: grow === true ? 1 : grow || 1, flexBasis: 0, background: on ? `color-mix(in srgb, ${bg} 75%, #333)` : bg, boxShadow: `inset 0 -3px 0 #00000045${active && color ? `, 0 0 0 2px ${color}` : ""}` }}>
      <span className="absolute left-3 top-1.5 font-mono text-[11px] text-[#d0cece99]">{hint}</span>
      <span className={`truncate ${big ? "text-center text-base" : "text-base"} ${on ? "font-semibold text-[#f0eeee]" : ""}`} style={{ color: on ? undefined : color ?? C.ink }}>{label}</span>
    </button>
  );
}

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className={`absolute inset-0 z-40 bg-black/50 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside className={`absolute right-0 top-0 z-50 flex h-full w-[min(480px,92vw)] flex-col border-l border-line bg-panel shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="font-semibold">{title}</div>
          <button className="btn btn-ghost !px-2.5 !py-1 text-mute" onClick={onClose}>✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-left scroll-thin">{children}</div>
      </aside>
    </>
  );
}

function Suggestions({ list }: { list: Suggestion[] }) {
  const done = list.filter((s) => s.state === "done");
  const rest = list.filter((s) => s.state !== "done");
  const left = rest.reduce((m, s) => m + s.expectedMin, 0);
  return (
    <div>
      <p className="mb-4 text-sm text-mute">
        Changes after every problem you finish, based on your time and whether you needed help. Training never runs out: when this list ends, more is added.
      </p>
      <div className="eyebrow mb-2">Up next · ~{fmtMinutes(left)}</div>
      <div className="space-y-1.5">
        {rest.map((s, i) => <SuggestionRow key={`r${i}`} s={s} n={i + 1} />)}
        {!rest.length && <div className="text-sm text-dim">More will be added when you get here.</div>}
      </div>
      {done.length > 0 && (
        <>
          <div className="eyebrow mb-2 mt-6">Done today · {done.length}</div>
          <div className="space-y-2 opacity-70">{done.map((s, i) => <SuggestionRow key={`d${i}`} s={s} n={i + 1} />)}</div>
        </>
      )}
    </div>
  );
}

function SuggestionRow({ s, n }: { s: Suggestion; n: number }) {
  const m = PLATFORM_META[s.platform];
  const d = s.difficulty ?? (s.rating ? String(s.rating) : "");
  return (
    <div className={`flex items-center gap-3 rounded-md border px-3 py-2 ${s.state === "current" || s.state === "next" ? "border-accent/50 bg-accent-soft" : "border-line bg-panel"}`}>
      <span className="w-5 text-right font-mono text-xs text-dim">{s.state === "done" ? "✓" : n}</span>
      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: m?.color }}>{m?.short}</span>
      <div className="min-w-0 flex-1">
        <div className={`truncate ${s.state === "done" ? "line-through decoration-dim" : ""}`}>{s.title}</div>
        <div className="text-xs text-mute">{s.track}</div>
      </div>
      <span className="text-xs font-semibold" style={{ color: diffColor(s.difficulty, s.rating) }}>{d}</span>
      <span className="num w-12 text-right text-xs text-mute">{s.expectedMin}m</span>
    </div>
  );
}

function confirmInline() {
  // Avoid blocking browser dialogs: a second click within 3 s confirms.
  const w = window as unknown as { __cpDiscard?: number };
  const now = Date.now();
  if (w.__cpDiscard && now - w.__cpDiscard < 3000) return true;
  w.__cpDiscard = now;
  toast("Click again to discard this attempt");
  return false;
}

function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm text-ink shadow-lg z-50";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="mt-4 rounded-md border border-red/40 bg-red-soft p-3 text-sm text-red">{msg}</div>;
}

// ----------------------------------------------------------------------------- feedback

function FeedbackForm({ v, busy, act, err, top, drawers, onQuitHome }: {
  v: TrainView; busy: boolean; act: (b: Record<string, unknown>) => Promise<TrainView | undefined>; err: string | null;
  top: (onQuit: () => void) => React.ReactNode; drawers: React.ReactNode; onQuitHome: () => void;
}) {
  const a = v.attempt!, p = v.problem!;
  const [felt, setFelt] = useState<number | null>(null);
  const [keyIdea, setKeyIdea] = useState("");
  const [slowed, setSlowed] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>(v.images);
  const [uploading, setUploading] = useState(0);
  const [upErr, setUpErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const total = a.thinkSec + a.stuckSec + a.codeSec;

  const upload = useCallback(async (files: File[]) => {
    for (const f of files.filter((f) => f.type.startsWith("image/"))) {
      setUploading((n) => n + 1);
      try {
        const fd = new FormData();
        fd.append("attemptId", String(a.id));
        fd.append("file", f);
        const r = await api<{ url: string }>("/api/upload", fd);
        setImages((im) => [...im, r.url]);
      } catch (e) {
        setUpErr((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }, [a.id]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) { e.preventDefault(); upload(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  const r = v.reveal;
  const canSave = felt != null && keyIdea.trim().length > 0 && uploading === 0;
  const save = () => act({ action: "feedback", id: a.id, felt, keyIdea, slowedBy: slowed, notes: notes || undefined });
  const quit = async () => {
    if (!canSave) { toast("Pick how hard it felt and write the key idea first"); return; }
    const nv = await save();
    if (nv) onQuitHome();
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div className="relative">{top(quit)}</div>
      <div className="relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-8 pb-6">
        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="chip font-bold" style={{ color: RESULT_COLOR[a.result!], borderColor: RESULT_COLOR[a.result!] }}>{RESULT_LABEL[a.result!]}</span>
            <span className="chip num">{fmtDuration(total)}</span>
            <span className="chip num text-mute">think {fmtDuration(a.thinkSec)} · stuck {fmtDuration(a.stuckSec)} · code {fmtDuration(a.codeSec)}</span>
          </div>
          <h1 className="mt-2 truncate font-semibold" style={{ fontSize: "clamp(1.8rem, 3.6vw, 3rem)" }}>{p.title}</h1>
        </div>

        <div className="mt-[2vh] grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
          {/* left: the 30-second part */}
          <div className="card flex min-h-0 flex-col gap-[2.4vh] overflow-y-auto p-6 scroll-thin">
            <section>
              <div className="text-lg font-semibold">How hard did it feel?</div>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setFelt(n)} className={`btn num !py-[1.4vh] !text-lg ${felt === n ? "btn-primary" : ""}`}>
                    {n}<span className="ml-1.5 hidden text-xs font-normal xl:inline">{["easy", "ok", "medium", "hard", "very hard"][n - 1]}</span>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <label className="text-lg font-semibold">Key idea in one line <span className="text-accent">*</span></label>
              <input className="input mt-2 !py-3 !text-lg" placeholder="e.g. binary search on the answer k, check hours(k) ≤ h" value={keyIdea} onChange={(e) => setKeyIdea(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && canSave && !busy) save(); }} />
            </section>
            <section>
              <div className="text-lg font-semibold">What slowed you down? <span className="text-sm font-normal text-mute">optional</span></div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SLOWED_BY.map((s) => (
                  <button key={s.id} onClick={() => setSlowed((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))} className={`btn !py-1.5 ${slowed.includes(s.id) ? "!border-accent !bg-accent-soft text-accent" : ""}`}>{s.label}</button>
                ))}
              </div>
            </section>
          </div>

          {/* right: notes, drawings, and last time (re-solves only, now that you've finished) */}
          <div className="card flex min-h-0 flex-col gap-3 overflow-y-auto p-6 scroll-thin">
            {r && (
              <div className="rounded-md border border-green/40 bg-green-soft p-4">
                <div className="eyebrow !text-green">Compare with last time · {new Date(r.date).toLocaleDateString()}</div>
                <div className="mt-2 grid gap-1 md:grid-cols-[auto_1fr] md:gap-x-4">
                  <span className="text-mute">Result</span><span style={{ color: RESULT_COLOR[r.result ?? ""] }}>{RESULT_LABEL[r.result ?? ""] ?? "—"} in {fmtDuration(r.totalSec)} {total < r.totalSec ? <b className="text-green">· faster now</b> : <span className="text-amber">· slower now</span>}</span>
                  <span className="text-mute">Key idea</span><span className="font-semibold">{r.keyIdea ?? "—"}</span>
                  {r.notes && (<><span className="text-mute">Notes</span><span className="whitespace-pre-wrap">{r.notes}</span></>)}
                </div>
                {!!r.images.length && <div className="mt-2 flex flex-wrap gap-2">{r.images.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-20 rounded-lg border border-line object-cover" /></a>)}</div>}
              </div>
            )}
            <div className="text-lg font-semibold">Notes &amp; drawings</div>
            <textarea className="input min-h-20 flex-1 !text-base" placeholder="Anything worth remembering…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div
              className="flex cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-line p-4 text-mute hover:border-accent/60"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); upload([...e.dataTransfer.files]); }}
            >
                            <span className="text-sm">Drop a photo, paste a screenshot (Ctrl+V), or click{uploading > 0 && <b className="ml-2 text-accent">Uploading…</b>}</span>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
            </div>
            {upErr && <ErrorBox msg={upErr} />}
            {!!images.length && <div className="flex flex-wrap gap-2">{images.map((u) => <img key={u} src={u} alt="" className="h-16 rounded-lg border border-line object-cover" />)}</div>}
          </div>
        </div>

        <div className="mt-[2vh] flex items-center justify-center gap-4">
          <button className="btn btn-primary !px-14 !py-[1.6vh] !text-lg" disabled={!canSave || busy} onClick={save}>Save &amp; next problem →</button>
          {!canSave && <span className="text-sm text-dim">Pick how hard it felt and write the key idea.</span>}
        </div>
        {err && <ErrorBox msg={err} />}
      </div>
      {drawers}
    </div>
  );
}

// ----------------------------------------------------------------------------- idle

type IdleDetectorT = { addEventListener: (t: string, f: () => void) => void; start: (o: { threshold: number; signal: AbortSignal }) => Promise<void>; userState: string; screenState: string };

function useIdlePause(attemptId: number | null, idleMin: number, onIdle: (lastActiveAt: number) => void) {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    if (!attemptId || idleMin <= 0) return;
    const thresholdMs = idleMin * 60e3;
    const ac = new AbortController();
    let fired = false;
    const fire = (at: number) => { if (!fired) { fired = true; cb.current(at); } };

    // 1) System-wide idle detection (Chrome), if you granted it in Settings.
    const W = window as unknown as { IdleDetector?: { new (): IdleDetectorT } };
    let usingSystem = false;
    (async () => {
      try {
        if (!W.IdleDetector) return;
        const perm = await navigator.permissions.query({ name: "idle-detection" as PermissionName });
        if (perm.state !== "granted") return;
        const d = new W.IdleDetector();
        d.addEventListener("change", () => { if (d.userState === "idle") fire(Date.now() - thresholdMs); });
        await d.start({ threshold: Math.max(60e3, thresholdMs), signal: ac.signal });
        usingSystem = true;
      } catch { /* unsupported */ }
    })();

    // 2) Fallback: activity in this tab while it is visible. When you are on the
    //    problem tab we can't see your activity, so we never pause for that.
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const evs = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const onVis = () => bump();
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => {
      if (usingSystem || document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (Date.now() - last >= thresholdMs) fire(last);
    }, 15000);

    return () => {
      ac.abort();
      clearInterval(t);
      evs.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [attemptId, idleMin]);
}
