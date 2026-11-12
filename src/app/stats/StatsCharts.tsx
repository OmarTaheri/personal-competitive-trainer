"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tip = { contentStyle: { background: "#ffffff", border: "1px solid #e3e3df", borderRadius: 6, color: "#1f2328", fontSize: 12 }, labelStyle: { color: "#6b6f76" }, cursor: { fill: "#efefec" } };
const STATUS_COLOR: Record<string, string> = { strong: "#2e9d57", learning: "#d99a00", weak: "#d64545", new: "#9a9ea5" };

export default function StatsCharts({ series, byRating, phases, slowed, mastery }: {
  series: { date: string; minutes: number; solved: number }[];
  byRating: { rating: string; solved: number; help: number; gaveUp: number }[];
  phases: { think: number; stuck: number; code: number };
  slowed: { name: string; value: number }[];
  mastery: { name: string; score: number; attempts: number; status: string }[];
}) {
  const phaseData = [
    { name: "Thinking", value: Math.round(phases.think / 60), color: "#2f6fde" },
    { name: "Stuck", value: Math.round(phases.stuck / 60), color: "#d64545" },
    { name: "Coding", value: Math.round(phases.code / 60), color: "#2e9d57" },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Minutes per day (90 days)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={series} margin={{ left: -18 }}>
            <CartesianGrid stroke="#e3e3df" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} stroke="#9a9ea5" fontSize={11} minTickGap={24} tickLine={false} axisLine={false} />
            <YAxis stroke="#9a9ea5" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Bar dataKey="minutes" fill="#2f6fde" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Results by rating (Codeforces scale)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byRating} margin={{ left: -18 }}>
            <CartesianGrid stroke="#e3e3df" vertical={false} />
            <XAxis dataKey="rating" stroke="#9a9ea5" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#9a9ea5" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="solved" name="Solved" stackId="a" fill="#2e9d57" />
            <Bar dataKey="help" name="With help" stackId="a" fill="#d99a00" />
            <Bar dataKey="gaveUp" name="Gave up" stackId="a" fill="#d64545" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Concept mastery (weakest first)">
        {mastery.length ? (
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-2 scroll-thin">
            {mastery.map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-48 truncate text-sm">{m.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${m.score}%`, background: STATUS_COLOR[m.status] }} /></div>
                <span className="w-10 text-right font-mono text-sm" style={{ color: STATUS_COLOR[m.status] }}>{m.score}</span>
                <span className="w-12 text-right text-xs text-dim">{m.attempts}×</span>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Where your time goes">
          {phaseData.some((p) => p.value) ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={phaseData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                  {phaseData.map((p) => <Cell key={p.name} fill={p.color} />)}
                </Pie>
                <Tooltip {...tip} formatter={(v) => `${v} min`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>
        <Card title="What slows you down">
          {slowed.some((s) => s.value) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={slowed} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#6b6f76" fontSize={11} width={110} tickLine={false} axisLine={false} />
                <Tooltip {...tip} />
                <Bar dataKey="value" fill="#2f6fde" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card card-pad"><div className="eyebrow mb-3">{title}</div>{children}</div>;
}

function Empty() {
  return <div className="grid h-40 place-items-center text-sm text-dim">Finish a few problems to see this.</div>;
}
