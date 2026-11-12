import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getStatus } from "@/lib/server/status";

export const metadata: Metadata = { title: "CP Training", description: "Your competitive programming training base" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-dvh overflow-hidden">
        <AppShell status={getStatus()}>{children}</AppShell>
      </body>
    </html>
  );
}
