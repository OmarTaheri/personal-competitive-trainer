import { NextResponse } from "next/server";
import { getStatus } from "@/lib/server/status";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getStatus());
}
