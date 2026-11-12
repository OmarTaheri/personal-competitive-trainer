"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; minutes: number; solved: number };

export default function TrainingChart({ series, goal }: { series: Point[]; goal: number }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const data = series.slice(-range);
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const solved = data.reduce((s, d) => s + d.solved, 0);
  return (
    <div className="card flex h-full min-h-[150px] flex-col p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-mute">Training time · last {range} days</div>
          <div className="mt-1 text-3xl font-black tabular-nums">
            {Math.floor(total / 60)}<span className="text-lg font-normal text-mute">h </span>{total % 60}<span className="text-lg font-normal text-mute">m</span>
            <span className="ml-3 text-base font-semibold text-green">{solved} solved</span>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {([7, 30, 90] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-lg px-3 py-1 text-sm ${range === r ? "bg-orange text-black font-semibold" : "text-mute hover:text-ink"}`}>{r}d</button>
          ))}
        </div>
      </div>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fillMin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ffffff10" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#1b1b21", border: "1px solid #26262e", borderRadius: 12, color: "#f4f4f5" }} labelStyle={{ color: "#9ca3af" }}
              formatter={(v, n) => [n === "minutes" ? `${v} min` : String(v), n === "minutes" ? "Trained" : "Solved"]} />
            <ReferenceLine y={goal} stroke="#ff7a1a" strokeDasharray="6 4" label={{ value: "goal", fill: "#ff7a1a", fontSize: 11, position: "insideTopRight" }} />
            <Area type="monotone" dataKey="minutes" stroke="#22c55e" strokeWidth={2.5} fill="url(#fillMin)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
