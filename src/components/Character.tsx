"use client";

import { useState } from "react";
export type { GroupMastery } from "@/lib/character";
import type { GroupMastery } from "@/lib/character";

const STATUS_COLOR = { strong: "#2e9d57", learning: "#d99a00", weak: "#d64545", new: "#b8bbc0" } as const;

/** Where each concept group "lives" on the body (percent of the figure box). */
const SPOTS: Record<string, { x: number; y: number; label: string }> = {
  DP: { x: 63, y: 14, label: "Dynamic Programming" },
  Math: { x: 37, y: 14, label: "Math" },
  Trees: { x: 31, y: 34, label: "Trees" },
  Graphs: { x: 56, y: 39, label: "Graphs" },
  "Data structures": { x: 22, y: 50, label: "Data structures" },
  Search: { x: 78, y: 50, label: "Search & Backtracking" },
  Greedy: { x: 50, y: 49, label: "Greedy & Intervals" },
  Basics: { x: 42, y: 77, label: "Basics" },
};

export default function Character({ level, cfRating, groups, className = "", info = true }: { level: number; cfRating: number | null; groups: GroupMastery[]; className?: string; info?: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  // Gear is earned: at level 1 you only have plain shorts.
  const tee = level >= 2, joggers = level >= 3, sneakers = level >= 4, headband = level >= 5, wrist = level >= 7;
  const hoodie = level >= 10, phones = level >= 15, aura = level >= 20, laptop = level >= 25, gold = level >= 30;
  const shirt = tee || hoodie;
  // Light-medium skin.
  const skin = "#dcaa82", skinShade = "#c08b64", skinDeep = "#a3714d", outline = "#4a2f20";
  const hair = "#20140e", hairMid = "#2e1d14", hairHi = "#4a3022";
  const top = hoodie ? "#2f6fde" : "#1f2430";
  const topShade = hoodie ? "#2459b8" : "#151922";
  const gm = new Map(groups.map((g) => [g.group, g]));
  const weakest = [...groups].filter((g) => g.score != null).sort((a, b) => (a.score ?? 1) - (b.score ?? 1))[0];
  const shown = hover ? gm.get(hover) : weakest;
  const armL = "M104 170 Q80 222 82 288", armR = "M196 170 Q220 222 218 288";

  return (
    <div className={`relative mx-auto aspect-[3/5] max-h-full max-w-full select-none ${className}`}>
      <svg viewBox="0 -24 300 524" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#2f6fde" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="faceShade" cx="45%" cy="40%" r="65%">
            <stop offset="70%" stopColor={skin} />
            <stop offset="100%" stopColor={skinShade} />
          </radialGradient>
          <linearGradient id="torsoShade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={skinShade} />
            <stop offset="22%" stopColor={skin} />
            <stop offset="78%" stopColor={skin} />
            <stop offset="100%" stopColor={skinShade} />
          </linearGradient>
          <radialGradient id="afroShade" cx="40%" cy="28%" r="80%">
            <stop offset="0%" stopColor={hairMid} />
            <stop offset="45%" stopColor={hairMid} />
            <stop offset="100%" stopColor={hair} />
          </radialGradient>
        </defs>
        {aura && <ellipse cx="150" cy="250" rx="150" ry="240" fill="url(#aura)" />}
        {/* orbit + shadow */}
        <ellipse cx="150" cy="470" rx="110" ry="20" fill="none" stroke="#3a3a44" strokeDasharray="6 6" strokeWidth="2" />
        <ellipse cx="150" cy="468" rx="62" ry="9" fill="#000" opacity="0.55" />

        {/* ---------- afro (behind head) ---------- */}
        <g fill={hair}>
          <ellipse cx="150" cy="78" rx="84" ry="76" />
          {Array.from({ length: 24 }, (_, i) => {
            const t = (i / 24) * Math.PI * 2;
            return <circle key={i} cx={(150 + Math.cos(t) * 82).toFixed(1)} cy={(78 + Math.sin(t) * 74).toFixed(1)} r={14 + (i % 3) * 1.5} />;
          })}
        </g>
        <ellipse cx="150" cy="76" rx="78" ry="70" fill="url(#afroShade)" />
        {/* curl texture */}
        <g fill="none" stroke={hairHi} strokeWidth="1.6" strokeLinecap="round" opacity="0.6">
          {Array.from({ length: 46 }, (_, i) => {
            const t = i * 2.39996, rr = 10 + ((i * 41) % 66);
            const x = 150 + Math.cos(t) * rr, y = 72 + Math.sin(t) * rr * 0.88;
            return <path key={i} d={`M${(x - 3).toFixed(1)} ${y.toFixed(1)} a3 3 0 1 1 3 3`} />;
          })}
        </g>
        <g fill={hair} opacity="0.7">
          {Array.from({ length: 20 }, (_, i) => {
            const t = i * 2.1 + 0.7, rr = 20 + ((i * 29) % 52);
            return <circle key={i} cx={(150 + Math.cos(t) * rr).toFixed(1)} cy={(76 + Math.sin(t) * rr * 0.85).toFixed(1)} r={2.2} />;
          })}
        </g>
        <path d="M86 52 Q104 14 150 6" stroke="#6b4a36" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.55" />

        {/* ---------- neck ---------- */}
        <rect x="137" y="126" width="26" height="32" rx="9" fill={skinShade} stroke={outline} strokeWidth="1.2" />
        <path d="M138 134 Q150 146 162 134 L162 140 Q150 152 138 140 Z" fill={skinDeep} opacity="0.55" />

        {/* ---------- legs ---------- */}
        {joggers ? (
          <g>
            <path d="M108 290 L116 440 L142 440 L148 318 L152 318 L158 440 L184 440 L192 290 Z" fill="#141a26" stroke="#0b0f17" strokeWidth="1.5" />
            <path d="M150 316 L150 440" stroke="#0b0f17" strokeWidth="2" />
            <path d="M124 330 Q128 380 126 430" stroke="#ffffff10" strokeWidth="5" fill="none" />
            <rect x="114" y="428" width="30" height="10" rx="3" fill="#0e131d" />
            <rect x="156" y="428" width="30" height="10" rx="3" fill="#0e131d" />
            <path d="M188 300 L186 420" stroke="#22c55e" strokeWidth="3" opacity="0.8" />
          </g>
        ) : (
          <g stroke={outline} strokeWidth="1.2">
            <path d="M112 346 L117 440 L141 440 L146 350 Z" fill={skin} />
            <path d="M154 350 L159 440 L183 440 L188 346 Z" fill={skin} />
            <ellipse cx="130" cy="394" rx="8" ry="6" fill={skinShade} stroke="none" opacity="0.7" />
            <ellipse cx="170" cy="394" rx="8" ry="6" fill={skinShade} stroke="none" opacity="0.7" />
            <path d="M120 410 Q124 425 122 438" stroke={skinShade} strokeWidth="2" fill="none" />
            <path d="M180 410 Q176 425 178 438" stroke={skinShade} strokeWidth="2" fill="none" />
          </g>
        )}
        {/* plain shorts: the only thing you start with */}
        {!joggers && (
          <g>
            <path d="M106 288 Q150 298 194 288 L198 352 L156 356 L150 322 L144 356 L102 352 Z" fill="#2a2f3a" stroke="#141820" strokeWidth="1.5" />
            <path d="M106 288 Q150 298 194 288 L195 298 Q150 308 105 298 Z" fill="#3a4150" />
            <path d="M150 304 L150 322" stroke="#141820" strokeWidth="1.5" />
          </g>
        )}
        {/* feet */}
        {sneakers ? (
          <g>
            <path d="M108 440 h38 a8 8 0 0 1 8 8 v6 h-52 a6 6 0 0 1 -2 -6 z" fill={gold ? "#f5b301" : "#f4f4f5"} stroke="#00000055" />
            <path d="M146 440 h38 a8 8 0 0 1 8 8 v6 h-52 a6 6 0 0 1 -2 -6 z" transform="translate(4 0)" fill={gold ? "#f5b301" : "#f4f4f5"} stroke="#00000055" />
            <path d="M116 444 l6 4 M124 443 l6 4 M132 443 l6 4" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M162 444 l6 4 M170 443 l6 4 M178 443 l6 4" stroke="#9ca3af" strokeWidth="1.5" />
            <rect x="104" y="452" width="52" height="4" rx="2" fill="#22c55e" />
            <rect x="146" y="452" width="52" height="4" rx="2" fill="#2f6fde" />
          </g>
        ) : (
          <g fill={skin} stroke={outline} strokeWidth="1.2">
            <path d="M114 438 h28 q8 0 8 9 v4 h-40 q-4 -2 -2 -6 z" />
            <path d="M158 438 h28 q6 7 4 13 h-40 v-4 q0 -9 8 -9 z" />
            <path d="M113 448 v3 M118 447 v4 M123 447 v4" stroke={skinDeep} strokeWidth="1" />
            <path d="M177 447 v4 M182 447 v4 M187 448 v3" stroke={skinDeep} strokeWidth="1" />
          </g>
        )}

        {/* ---------- arms ---------- */}
        <path d={armL} stroke={outline} strokeWidth="27" strokeLinecap="round" fill="none" />
        <path d={armR} stroke={outline} strokeWidth="27" strokeLinecap="round" fill="none" />
        <path d={armL} stroke={skin} strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d={armR} stroke={skin} strokeWidth="24" strokeLinecap="round" fill="none" />
        <path d="M92 232 Q86 252 86 270" stroke={skinShade} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M208 232 Q214 252 214 270" stroke={skinShade} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.8" />
        {hoodie ? (
          <>
            <path d={armL} stroke={top} strokeWidth="28" strokeLinecap="round" fill="none" />
            <path d={armR} stroke={top} strokeWidth="28" strokeLinecap="round" fill="none" />
            <path d="M74 280 h16 M210 280 h16" stroke={topShade} strokeWidth="8" strokeLinecap="round" />
          </>
        ) : tee ? (
          <>
            <path d="M104 170 Q94 190 90 212" stroke={top} strokeWidth="31" strokeLinecap="round" fill="none" />
            <path d="M196 170 Q206 190 210 212" stroke={top} strokeWidth="31" strokeLinecap="round" fill="none" />
          </>
        ) : null}
        {wrist && <rect x="70" y="270" width="24" height="9" rx="3" fill="#22c55e" stroke="#15803d" />}
        {/* hands with fingers */}
        <g stroke={outline} strokeWidth="1.2">
          <circle cx="82" cy="298" r="13" fill={skin} />
          <circle cx="218" cy="298" r="13" fill={skin} />
          <path d="M76 304 v6 M81 305 v7 M86 304 v6" stroke={skinDeep} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M212 304 v6 M217 305 v7 M222 304 v6" stroke={skinDeep} strokeWidth="1.6" strokeLinecap="round" />
        </g>
        {laptop && (
          <g transform="translate(212 300) rotate(-8)">
            <rect x="-6" y="-2" width="54" height="36" rx="4" fill="#2b2f38" stroke="#0b0b0d" />
            <rect x="-2" y="2" width="46" height="26" rx="2" fill="#0b0b0d" />
            <path d="M3 9 h14 M3 14 h22 M3 19 h10" stroke="#22c55e" strokeWidth="2" />
            <path d="M27 9 h8" stroke="#2f6fde" strokeWidth="2" />
          </g>
        )}

        {/* ---------- torso ---------- */}
        {shirt ? (
          <>
            <path d="M98 160 Q150 140 202 160 L190 300 Q150 310 110 300 Z" fill={top} stroke="#00000066" strokeWidth="1.2" />
            <path d="M110 300 Q150 310 190 300 L188 290 Q150 298 112 290 Z" fill={topShade} />
            <path d="M124 200 Q132 240 126 280" stroke="#00000022" strokeWidth="3" fill="none" />
            <path d="M176 200 Q168 240 174 280" stroke="#00000022" strokeWidth="3" fill="none" />
          </>
        ) : (
          <g>
            <path d="M100 162 Q150 146 200 162 L192 296 Q150 304 108 296 Z" fill="url(#torsoShade)" stroke={outline} strokeWidth="1.3" />
            {/* collarbones, chest and belly: simple cartoon lines */}
            <path d="M124 166 Q136 170 146 166 M154 166 Q164 170 176 166" stroke={skinShade} strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M116 200 Q132 212 148 202 M152 202 Q168 212 184 200" stroke={skinDeep} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
            <path d="M150 214 L150 262" stroke={skinShade} strokeWidth="1.6" opacity="0.8" />
            <path d="M138 232 q12 3 24 0 M139 250 q11 3 22 0" stroke={skinShade} strokeWidth="1.4" fill="none" opacity="0.7" />
            <ellipse cx="150" cy="274" rx="2" ry="3" fill={skinDeep} />
          </g>
        )}
        {hoodie ? (
          <>
            <path d="M116 150 Q150 186 184 150 Q170 166 150 168 Q130 166 116 150 Z" fill={topShade} />
            <path d="M126 250 h48 l6 34 h-60 z" fill={topShade} />
            <line x1="142" y1="164" x2="140" y2="200" stroke="#f4f4f5" strokeWidth="3" strokeLinecap="round" />
            <line x1="158" y1="164" x2="160" y2="200" stroke="#f4f4f5" strokeWidth="3" strokeLinecap="round" />
            <circle cx="140" cy="202" r="2.5" fill="#f4f4f5" />
            <circle cx="160" cy="202" r="2.5" fill="#f4f4f5" />
          </>
        ) : tee ? (
          <>
            <path d="M130 150 Q150 170 170 150 Q150 160 130 150 Z" fill={skinShade} />
            <path d="M132 150 Q150 168 168 150" stroke="#2c3344" strokeWidth="5" fill="none" />
            <rect x="104" y="214" width="92" height="8" fill="#2f6fde" opacity="0.9" />
            <rect x="104" y="226" width="92" height="4" fill="#22c55e" opacity="0.9" />
          </>
        ) : null}
        {phones && (
          <g>
            <path d="M118 160 Q150 196 182 160" stroke="#22c55e" strokeWidth="6" fill="none" />
            <rect x="108" y="150" width="16" height="22" rx="6" fill="#16a34a" />
            <rect x="176" y="150" width="16" height="22" rx="6" fill="#16a34a" />
          </g>
        )}
        {cfRating && shirt ? (
          <g>
            <rect x="160" y="176" width="34" height="18" rx="5" fill="#0b0b0d" stroke="#2f6fde" />
            <text x="177" y="189" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2f6fde" fontFamily="monospace">{cfRating}</text>
          </g>
        ) : null}

        {/* ---------- head ---------- */}
        <g stroke={outline} strokeWidth="1.2">
          <ellipse cx="106" cy="104" rx="9" ry="11" fill={skinShade} />
          <ellipse cx="194" cy="104" rx="9" ry="11" fill={skinShade} />
        </g>
        <path d="M104 99 q4 5 0 11" stroke={skinDeep} strokeWidth="2" fill="none" />
        <path d="M196 99 q-4 5 0 11" stroke={skinDeep} strokeWidth="2" fill="none" />
        <ellipse cx="150" cy="100" rx="44" ry="46" fill="url(#faceShade)" stroke={outline} strokeWidth="1.3" />
        <path d="M118 124 Q150 152 182 124 Q170 146 150 147 Q130 146 118 124 Z" fill={skinShade} opacity="0.5" />
        {/* afro front fringe + hairline */}
        <path d="M104 98 Q100 50 150 46 Q200 50 196 98 Q190 76 172 72 Q150 80 128 72 Q110 76 104 98 Z" fill={hair} />
        <g fill="none" stroke={hairHi} strokeWidth="1.5" opacity="0.7" strokeLinecap="round">
          <path d="M120 64 a3 3 0 1 1 3 3" />
          <path d="M140 56 a3 3 0 1 1 3 3" />
          <path d="M162 57 a3 3 0 1 1 3 3" />
          <path d="M180 66 a3 3 0 1 1 3 3" />
        </g>
        <path d="M108 92 q2 -8 6 -12 M192 92 q-2 -8 -6 -12" stroke={hair} strokeWidth="5" strokeLinecap="round" />
        {headband && <path d="M103 78 Q150 58 197 78 L197 89 Q150 69 103 89 Z" fill="#2f6fde" stroke="#2459b8" strokeWidth="1" />}
        {/* eyebrows */}
        <path d="M124 94 q9 -7 19 -2 l-1 3 q-9 -3 -17 2 z" fill={hair} />
        <path d="M176 94 q-9 -7 -19 -2 l1 3 q9 -3 17 2 z" fill={hair} />
        {/* eyes */}
        <ellipse cx="134" cy="106" rx="7" ry="5.5" fill="#fbf7f2" stroke={outline} strokeWidth="1" />
        <ellipse cx="166" cy="106" rx="7" ry="5.5" fill="#fbf7f2" stroke={outline} strokeWidth="1" />
        <circle cx="135" cy="106.5" r="3.8" fill="#4a2c1a" />
        <circle cx="167" cy="106.5" r="3.8" fill="#4a2c1a" />
        <circle cx="135" cy="106.5" r="1.8" fill="#120b07" />
        <circle cx="167" cy="106.5" r="1.8" fill="#120b07" />
        <circle cx="136.4" cy="105" r="1.2" fill="#fff" />
        <circle cx="168.4" cy="105" r="1.2" fill="#fff" />
        <path d="M127 101.5 q7 -4 14 0 M159 101.5 q7 -4 14 0" stroke={outline} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* nose */}
        <path d="M150 108 q-2 8 -5 11 q5 3 10 0" stroke={skinDeep} strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="146" cy="120" rx="1.6" ry="1" fill={skinDeep} />
        <ellipse cx="154" cy="120" rx="1.6" ry="1" fill={skinDeep} />
        {/* mouth */}
        <path d="M138 128 q12 9 24 0 q-12 4 -24 0 z" fill="#8a3e32" />
        <path d="M140 129 q10 3 20 0" stroke="#f4ece6" strokeWidth="1.6" fill="none" />
        <path d="M141 134 q9 4 18 0" stroke="#a2584a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* cheeks */}
        <circle cx="122" cy="120" r="5.5" fill="#e98a7a" opacity="0.3" />
        <circle cx="178" cy="120" r="5.5" fill="#e98a7a" opacity="0.3" />
      </svg>

      {/* hotspots */}
      {Object.entries(SPOTS).map(([g, s]) => {
        const m = gm.get(g);
        const color = STATUS_COLOR[m?.status ?? "new"];
        return (
          <button key={g} onMouseEnter={() => setHover(g)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(g)}
            className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }} aria-label={s.label}>
            <span className="relative grid h-6 w-6 place-items-center rounded-full" style={{ background: color + "33", boxShadow: m?.status === "weak" ? `0 0 16px ${color}` : undefined }}>
              <span className="h-3 w-3 rounded-full border-2 border-white/80" style={{ background: color }} />
            </span>
          </button>
        );
      })}

      {info && shown && (
        <div className="absolute right-[-12%] top-[18%] w-40 rounded-lg border border-line bg-panel/95 p-3 shadow-lg backdrop-blur">
          <div className="text-xs text-mute">{hover ? "Concept group" : "Weakest area"}</div>
          <div className="font-semibold">{SPOTS[shown.group]?.label ?? shown.group}</div>
          <div className="num mt-1 text-2xl font-semibold" style={{ color: STATUS_COLOR[shown.status] }}>
            {shown.score == null ? "—" : Math.round(shown.score * 100)}<span className="text-sm font-normal text-mute"> /100</span>
          </div>
          <div className="text-xs text-mute">{shown.attempts} attempts{shown.weakest ? ` · weakest: ${shown.weakest}` : ""}</div>
        </div>
      )}
    </div>
  );
}
