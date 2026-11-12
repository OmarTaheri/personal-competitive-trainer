"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  train: "M8 5v14l11-7z",
  problems: "M4 6h16M4 12h16M4 18h10",
  log: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
  calendar: "M4 6h16v15H4zM4 10h16M9 3v5M15 3v5",
  neetcode: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  stats: "M5 20V10M12 20V4M19 20v-7",
  review: "M4 6h16v15H4zM4 10h16M9 3v5M15 3v5M8 15l2.5 2.5L16 13",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

const NAV: { href: string; icon: keyof typeof I; label: string }[] = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/train", icon: "train", label: "Train" },
  { href: "/neetcode", icon: "neetcode", label: "NeetCode 250" },
  { href: "/problems", icon: "problems", label: "Problems" },
  { href: "/log", icon: "log", label: "Log" },
  { href: "/calendar", icon: "calendar", label: "Calendar" },
  { href: "/review", icon: "review", label: "Weekly review" },
  { href: "/stats", icon: "stats", label: "Stats" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex h-dvh w-[4.5rem] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-4">
      <Link href="/" className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-ink font-mono text-sm font-bold text-white" title="CP Training">
        {"</>"}
      </Link>
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} title={n.label}
            className={`flex w-16 flex-col items-center gap-0.5 rounded-md py-1.5 transition ${active ? "text-accent" : "text-mute hover:bg-panel2 hover:text-ink"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={I[n.icon]} /></svg>
            <span className="w-full truncate px-0.5 text-center text-[10px] leading-tight">{n.label.replace("Weekly review", "Review")}</span>
          </Link>
        );
      })}
      <form method="post" action="/api/logout" className="mt-auto">
        <button type="submit" title="Log out" className="flex w-16 flex-col items-center gap-0.5 rounded-md py-1.5 text-mute transition hover:bg-panel2 hover:text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          <span className="text-[10px] leading-tight">Log out</span>
        </button>
      </form>
    </aside>
  );
}
