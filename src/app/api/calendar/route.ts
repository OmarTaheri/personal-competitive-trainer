import { NextResponse } from "next/server";
import { calendarEvents } from "@/lib/server/calendar";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const u = new URL(req.url);
  const from = Number(u.searchParams.get("from")) || Date.now() - 7 * 86400e3;
  const to = Number(u.searchParams.get("to")) || Date.now() + 35 * 86400e3;
  return NextResponse.json(calendarEvents(from, to));
}
