"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KEYBOARD_ROWS } from "@/lib/concepts";
import type { ConceptKey } from "@/lib/server/home";
import { C, masteryColor, masteryInk, STATUS_COLOR } from "@/lib/ui";

const STATUS_LABEL: Record<ConceptKey["status"], string> = { strong: "Strong", learning: "Learning", weak: "Weak", new: "Not tried yet" };

/**
 * Your concepts laid out like a keyboard. Each key's color is how well you know it
 * (red → yellow → green), grey keys are untried, and outlined keys are today's focus.
 * `highlight` (e.g. the concepts of the problem you just did) dims everything else.
 */
export default function ConceptKeyboard({ keys, size = "lg", highlight, legend = true }: { keys: ConceptKey[]; size?: "lg" | "sm"; highlight?: string[]; legend?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const byGroup = new Map<string, ConceptKey[]>();
  for (const k of keys) byGroup.set(k.group, [...(byGroup.get(k.group) ?? []), k]);
  const hl = highlight?.length ? new Set(highlight) : null;

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  const lg = size === "lg";
  const keyCls = lg ? "h-[3.4rem] min-w-[3.4rem] text-[0.95rem]" : "h-10 min-w-10 text-xs";

  return (
    <div ref={root} className="select-none">
      <div className="flex justify-center"><div className={`flex flex-col items-start ${lg ? "gap-1.5" : "gap-1"}`}>
        {KEYBOARD_ROWS.map((groups, r) => (
          <div key={r} className={`flex items-end ${lg ? "gap-5" : "gap-3"}`} style={{ marginLeft: `${r * (lg ? 1.1 : 0.7)}rem` }}>
            {groups.map((g) => (
              <div key={g} className="flex flex-col">
                {lg && <span className="mb-0.5 pl-0.5 text-[10px] font-semibold uppercase tracking-wider text-dim">{g}</span>}
                <div className={`flex ${lg ? "gap-1.5" : "gap-1"}`}>
                  {(byGroup.get(g) ?? []).map((k) => {
                    const dimmed = hl && !hl.has(k.id);
                    return (
                      <div key={k.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpen(open === k.id ? null : k.id)}
                          title={k.name}
                          className={`relative flex ${keyCls} flex-col items-center justify-center rounded-md px-1.5 font-mono font-semibold transition hover:-translate-y-px ${dimmed ? "opacity-30" : ""}`}
                          style={{
                            background: masteryColor(k.score, k.attempts),
                            color: k.attempts ? "#1f2328cc" : C.dim,
                            boxShadow: `inset 0 -2px 0 #0000001a${k.focus || hl?.has(k.id) ? `, 0 0 0 2px ${C.accent}` : ""}`,
                          }}
                        >
                          {k.key}
                          {k.status === "weak" && <span className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded bg-red" />}
                          {lg && k.attempts > 0 && <span className="absolute right-1 top-0.5 text-[9px] font-normal opacity-60">{k.attempts}</span>}
                        </button>
                        {open === k.id && <KeyPopover k={k} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div></div>

      {legend && (
        <div className={`mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-mute ${lg ? "text-xs" : "text-[11px]"}`}>
          <span className="flex items-center gap-2">
            weak
            <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${masteryColor(0.3, 1)}, ${masteryColor(0.6, 1)}, ${masteryColor(0.9, 1)})` }} />
            strong
          </span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm" style={{ background: C.untried }} />not tried yet</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm" style={{ boxShadow: `0 0 0 2px ${C.accent}` }} />{hl ? "this problem" : "today's focus"}</span>
          <span className="text-dim">click a key for details</span>
        </div>
      )}
    </div>
  );
}

function KeyPopover({ k }: { k: ConceptKey }) {
  return (
    <div className="absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-panel p-3 text-left shadow-lg">
      <div className="text-sm font-semibold text-ink">{k.name}</div>
      <div className="mt-0.5 text-xs text-mute">{k.group}{k.focus ? " · today's focus" : ""}</div>
      <div className="mt-2 grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-2">
        <Metric label="Score" value={k.attempts ? `${Math.round((k.score ?? 0) * 100)}` : "–"} color={masteryInk(k.score, k.attempts)} />
        <Metric label="Tries" value={String(k.attempts)} />
        <Metric label="Status" value={STATUS_LABEL[k.status]} color={STATUS_COLOR[k.status]} small />
      </div>
      <Link href={`/problems?concept=${k.id}&status=unsolved`} className="mt-3 block rounded-md bg-accent-soft px-2 py-1.5 text-center text-xs font-medium text-accent hover:bg-accent hover:text-white">
        Practice {k.name} →
      </Link>
    </div>
  );
}

function Metric({ label, value, color, small }: { label: string; value: string; color?: string; small?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`num font-semibold ${small ? "text-xs leading-5" : "text-lg"}`} style={{ color }}>{value}</div>
    </div>
  );
}
