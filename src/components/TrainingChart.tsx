"use client";

import { useState } from "react";
import { C } from "@/lib/ui";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; minutes: number; solved: number };

export default function TrainingChart({ series, goal }: { series: Point[]; goal: number }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const data = series.slice(-range);
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const solved = data.reduce((s, d) => s + d.solved, 0);
  return (
    <div className="card flex h-full min-h-[220px] flex-col p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">Training time · last {range} days</div>
          <div className="num mt-1 text-2xl font-semibold">
            {Math.floor(total / 60)}<span className="text-base font-normal text-mute">h </span>{total % 60}<span className="text-base font-normal text-mute">m</span>
            <span className="ml-3 text-sm font-medium text-green">{solved} solved</span>
          </div>
        </div>
        <div className="flex gap-0.5 rounded-md border border-line p-0.5">
          {([7, 30, 90] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded px-2.5 py-0.5 text-xs ${range === r ? "bg-panel2 font-semibold text-ink" : "text-mute hover:text-ink"}`}>{r}d</button>
          ))}
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fillMin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity={0.18} />
                <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} stroke={C.dim} fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke={C.dim} fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, color: C.ink, fontSize: 12 }} labelStyle={{ color: C.mute }}
              formatter={(v, n) => [n === "minutes" ? `${v} min` : String(v), n === "minutes" ? "Trained" : "Solved"]} />
            <ReferenceLine y={goal} stroke={C.mute} strokeDasharray="4 4" label={{ value: "goal", fill: C.mute, fontSize: 11, position: "insideTopRight" }} />
            <Area type="monotone" dataKey="minutes" stroke={C.accent} strokeWidth={2} fill="url(#fillMin)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
