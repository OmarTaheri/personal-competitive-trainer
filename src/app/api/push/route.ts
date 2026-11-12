import { NextResponse } from "next/server";
import { saveSubscription, vapidKeys } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ publicKey: vapidKeys().publicKey });
}

export async function POST(req: Request) {
  const sub = await req.json();
  if (!sub?.endpoint) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  saveSubscription(sub);
  return NextResponse.json({ ok: true });
}
