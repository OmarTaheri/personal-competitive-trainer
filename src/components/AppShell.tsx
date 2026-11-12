"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import HeaderBar from "./HeaderBar";
import type { Status } from "@/lib/server/status";

/**
 * The window itself never scrolls. Normal pages: sidebar + header + a scrollable main.
 * /train is a full-screen focus mode with no sidebar or header (it has its own Quit button).
 */
export default function AppShell({ status, children }: { status: Status; children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") return <>{children}</>;
  if (path.startsWith("/train")) return <div className="h-dvh overflow-hidden">{children}</div>;
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar initial={status} />
        <main id="main" className="min-h-0 flex-1 overflow-y-auto px-6 py-5 scroll-thin">{children}</main>
      </div>
    </div>
  );
}
