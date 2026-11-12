"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrainView, HelpContent, Suggestion } from "@/lib/server/trainView";
import { api, C, diffColor, PLATFORM_META, refreshHeader, RESULT_COLOR, RESULT_LABEL, SLOWED_BY } from "@/lib/ui";
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
        <p className="mt-2 max-w-xl text-lg text-mute">Import Codeforces problems in Settings → Problem bank to unlock more.</p>
      </Screen>
    );
  }

  const p = v.problem;
  const meta = PLATFORM_META[p.platform];
  const chips = (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="chip font-semibold !text-white" style={{ background: meta.color, borderColor: meta.color }}>{meta.label}</span>
      <span className="chip">{p.track}</span>
      <Difficulty p={p} />
      <span className="chip num">~{p.expectedMin} min</span>
    </div>
  );

  // ----------------------------------------------------- next problem
  if (!a) {
    return (
      <Screen top={top(() => router.push("/"))} drawers={drawers}>
        {chips}
        <div className="eyebrow mt-[3vh] !tracking-[0.25em]">Next problem</div>
        <Title text={p.title} href={p.url} />
        <Tags p={p} />
        <button
          className="btn btn-primary mt-[5vh] !px-14 !py-[1.8vh] !text-2xl"
          disabled={busy}
          onClick={() => act({ action: "start", problemId: p.id })}
        >
          Start
        </button>
        <div className="mt-3 text-sm text-mute">Starts the timer. Click the problem name to open it in a new tab.</div>
        {err && <ErrorBox msg={err} />}
        <div className="mt-[5vh] w-full max-w-4xl border-t border-line pt-[3vh]">
          <div className="eyebrow mb-3">{v.last ? <>Your concepts · just practiced in <span className="normal-case tracking-normal text-ink">{v.last.title}</span></> : "Your concepts"}</div>
          <ConceptKeyboard keys={v.keys} size="sm" highlight={v.last?.concepts} />
        </div>
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

  return (
    <Screen top={top(quit)} drawers={drawers}>
      {chips}
      <div className="mt-[2vh] flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${running ? "animate-pulse" : ""}`} style={{ background: pm.color }} />
        <span className="text-base font-medium" style={{ color: pm.color }}>{pm.label}</span>
      </div>
      <Title text={p.title} href={p.url} />
      <Tags p={p} />

      <div className={`num mt-[2vh] font-semibold leading-none ${overExpected ? "text-red" : "text-ink"}`} style={{ fontSize: "clamp(3.5rem, 12vh, 8rem)" }}>{fmtDuration(total)}</div>
      <PhaseBar think={think} stuck={stuck} code={code} />

      <div className="mt-[3vh] flex flex-wrap justify-center gap-3">
        {phase !== "paused" ? (
          <>
            {phase !== "stuck" && <button className="btn !border-red/50 !px-6 !py-[1.3vh] !text-lg text-red" disabled={busy} onClick={() => act({ action: "phase", id: a.id, phase: "stuck" })}>I&apos;m stuck</button>}
            {phase !== "code" && <button className="btn !border-green/50 !px-6 !py-[1.3vh] !text-lg text-green" disabled={busy} onClick={() => act({ action: "phase", id: a.id, phase: "code" })}>{phase === "stuck" ? "Got it, coding" : "Start coding"}</button>}
            {phase !== "think" && <button className="btn !border-accent/50 !px-6 !py-[1.3vh] !text-lg text-accent" disabled={busy} onClick={() => act({ action: "phase", id: a.id, phase: "think" })}>Thinking</button>}
            <button className="btn !px-6 !py-[1.3vh] !text-lg" disabled={busy} onClick={() => act({ action: "phase", id: a.id, phase: "paused" })}>Pause</button>
          </>
        ) : (
          <button className="btn btn-primary !px-12 !py-[1.6vh] !text-xl" disabled={busy} onClick={() => act({ action: "resume", id: a.id })}>Resume</button>
        )}
      </div>

      <div className="mt-[3vh] grid w-full max-w-3xl grid-cols-3 gap-3">
        <button className="btn btn-green !py-[2vh] !text-xl" disabled={busy} onClick={() => act({ action: "finish", id: a.id, result: a.helpUsed === "none" ? "solved" : "solved_help" })}>Solved</button>
        <button className="btn !border-amber/60 !py-[2vh] !text-xl text-amber" disabled={busy} onClick={() => act({ action: "finish", id: a.id, result: "solved_help" })}>Solved with help</button>
        <button className="btn !border-red/50 !py-[2vh] !text-xl text-red" disabled={busy} onClick={() => act({ action: "finish", id: a.id, result: "gave_up" })}>Gave up</button>
      </div>

      <div className="mt-[2vh] flex gap-6 text-xs text-dim">
        <span>Auto-pauses after {v.settings.idlePauseMin} min idle.</span>
        <button className="hover:text-red" onClick={() => { if (confirmInline()) act({ action: "discard", id: a.id }); }}>Opened by mistake? Discard</button>
      </div>
      {err && <ErrorBox msg={err} />}
    </Screen>
  );
}

// ----------------------------------------------------------------------------- layout pieces

function Screen({ top, drawers, children }: { top: React.ReactNode; drawers: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div className="relative">{top}</div>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-6 text-center scroll-thin">{children}</div>
      {drawers}
    </div>
  );
}

function TopBar({ doneMin, goalMin, bonus, onSuggestions, onQuit, helpCount, onHelp }: { doneMin: number; goalMin: number; bonus: boolean; onSuggestions: () => void; onQuit: () => void; helpCount: number; onHelp: () => void }) {
  return (
    // Equal side columns so the middle stays exactly centred, in line with the title.
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-line bg-panel px-6 py-2.5">
      <button className="btn btn-ghost !px-3 justify-self-start text-mute" onClick={onQuit} title="Quit training">← Quit</button>
      <div className="flex items-center gap-1.5 text-sm text-mute">
        <span className="num font-semibold text-ink">{fmtMinutes(doneMin)}</span>
        <span>/ {fmtMinutes(goalMin)} today</span>
        {bonus && <span className="ml-2 text-xs text-green">goal done · bonus round</span>}
      </div>
      <div className="flex items-center gap-2 justify-self-end">
        {helpCount > 0 && <button className="btn !py-1.5 !text-sm !border-amber/50 text-amber" onClick={onHelp}>Help</button>}
        <button className="btn !py-1.5 !text-sm" onClick={onSuggestions}>Today&apos;s suggestions</button>
      </div>
    </div>
  );
}

function Title({ text, href }: { text: string; href?: string }) {
  const cls = "mt-[1.5vh] block max-w-6xl font-semibold leading-[1.08] tracking-tight";
  const style = { fontSize: text.length > 40 ? "clamp(2rem, 4.4vw, 3.6rem)" : "clamp(2.4rem, 5.6vw, 4.8rem)" };
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} hover:text-accent`} style={style} title="Open in a new tab">
      {text} <span className="align-middle text-[0.4em] text-mute">↗</span>
    </a>
  ) : <h1 className={cls} style={style}>{text}</h1>;
}

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className={`absolute inset-0 z-40 bg-ink/20 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
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
  el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-ink px-4 py-2 text-sm text-white shadow-lg z-50";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function Difficulty({ p }: { p: TrainView["problem"] & object }) {
  const label = p.difficulty ?? (p.rating ? `${p.rating}` : "?");
  const c = diffColor(p.difficulty, p.rating);
  return <span className="chip font-semibold" style={{ color: c, borderColor: c + "66" }}>{label}</span>;
}

function Tags({ p }: { p: TrainView["problem"] & object }) {
  if (p.tags === null) return <div className="mt-3 text-sm text-dim">Tags hidden (contest mode)</div>;
  if (!p.tags.length) return null;
  return <div className="mt-3 flex flex-wrap justify-center gap-2">{p.tags.slice(0, 6).map((t) => <span key={t} className="chip text-mute">{t}</span>)}</div>;
}

function PhaseBar({ think, stuck, code }: { think: number; stuck: number; code: number }) {
  const t = think + stuck + code || 1;
  return (
    <div className="mt-[2vh] w-full max-w-2xl">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
        <div style={{ width: `${(100 * think) / t}%`, background: PHASE_META.think.color }} />
        <div style={{ width: `${(100 * stuck) / t}%`, background: PHASE_META.stuck.color }} />
        <div style={{ width: `${(100 * code) / t}%`, background: PHASE_META.code.color }} />
      </div>
      <div className="num mt-2 flex justify-center gap-6 text-sm">
        <span style={{ color: PHASE_META.think.color }}>think {fmtDuration(think)}</span>
        <span style={{ color: PHASE_META.stuck.color }}>stuck {fmtDuration(stuck)}</span>
        <span style={{ color: PHASE_META.code.color }}>code {fmtDuration(code)}</span>
      </div>
    </div>
  );
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
