import { NextResponse } from "next/server";
import { sendPush, sendTelegram } from "@/lib/server/notify";

export async function POST(req: Request) {
  const { channel } = (await req.json()) as { channel: "push" | "telegram" };
  try {
    if (channel === "telegram") {
      const ok = await sendTelegram("✅ CP Training test message — contest reminders will arrive here.");
      if (!ok) return NextResponse.json({ error: "Set the bot token and chat id first" }, { status: 400 });
      return NextResponse.json({ ok: true, message: "Telegram message sent" });
    }
    const n = await sendPush("✅ CP Training", "Browser notifications work.", "/");
    if (!n) return NextResponse.json({ error: "No browser subscribed yet — click Enable first" }, { status: 400 });
    return NextResponse.json({ ok: true, message: `Sent to ${n} browser(s)` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
