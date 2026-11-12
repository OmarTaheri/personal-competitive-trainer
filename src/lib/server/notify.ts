import webpush from "web-push";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hourInTz } from "@/lib/time";
import { getSettings, today, updateSettings } from "./settings";
import { dueReviewCount } from "./training";

export function vapidKeys() {
  const s = getSettings();
  if (s.vapidPublic && s.vapidPrivate) return { publicKey: s.vapidPublic, privateKey: s.vapidPrivate };
  const k = webpush.generateVAPIDKeys();
  updateSettings({ vapidPublic: k.publicKey, vapidPrivate: k.privateKey });
  return k;
}

export function saveSubscription(sub: { endpoint: string }) {
  getDb().insert(schema.pushSubscriptions).values({ endpoint: sub.endpoint, json: JSON.stringify(sub) })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { json: JSON.stringify(sub) } }).run();
}

export async function sendPush(title: string, body: string, url = "/") {
  const k = vapidKeys();
  webpush.setVapidDetails("mailto:cp-training@localhost", k.publicKey, k.privateKey);
  const subs = getDb().select().from(schema.pushSubscriptions).all();
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(JSON.parse(s.json), JSON.stringify({ title, body, url }));
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) getDb().delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, s.endpoint)).run();
    }
  }
  return sent;
}

export async function sendTelegram(text: string): Promise<boolean> {
  const s = getSettings();
  if (!s.telegramToken || !s.telegramChatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${s.telegramToken.trim()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: s.telegramChatId.trim(), text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Telegram: ${res.status} ${await res.text()}`);
  return true;
}

export async function notifyAll(title: string, body: string, url = "/") {
  const out: string[] = [];
  try { out.push(`push ${await sendPush(title, body, url)}`); } catch (e) { out.push(`push failed: ${(e as Error).message}`); }
  try { out.push(`telegram ${(await sendTelegram(`${title}\n${body}${url.startsWith("http") ? "\n" + url : ""}`)) ? "sent" : "not configured"}`); } catch (e) { out.push(`telegram failed: ${(e as Error).message}`); }
  return out.join(", ");
}

function once(key: string): boolean {
  const r = getDb().insert(schema.sentNotifications).values({ key, at: Date.now() }).onConflictDoNothing().run();
  return r.changes > 0;
}

/** Runs every minute: contest reminders (60 / 10 min) and the daily re-solve digest. */
export async function tickNotifications() {
  const db = getDb();
  const now = Date.now();
  // Only contests you said you'll join.
  const soon = db.select().from(schema.contests).where(and(eq(schema.contests.joined, true), gte(schema.contests.startUtc, now), lte(schema.contests.startUtc, now + 61 * 60e3))).all();
  for (const c of soon) {
    const mins = Math.round((c.startUtc - now) / 60e3);
    if (mins <= 60 && mins > 10 && !c.reminded60) {
      db.update(schema.contests).set({ reminded60: true }).where(eq(schema.contests.id, c.id)).run();
      await notifyAll(`⏰ ${c.name} in 1 hour`, `${c.platform} contest starts in ${mins} minutes.`, c.url);
    } else if (mins <= 10 && !c.reminded10) {
      db.update(schema.contests).set({ reminded10: true, reminded60: true }).where(eq(schema.contests.id, c.id)).run();
      await notifyAll(`🚨 ${c.name} in ${mins} min`, `Get ready — ${c.platform} contest starts soon.`, c.url);
    }
  }
  const s = getSettings();
  if (hourInTz(now, s.timezone) >= s.digestHour) {
    const d = today(s);
    const n = Math.min(dueReviewCount(d), s.resolveCap);
    if (n > 0 && once(`digest:${d}`)) {
      // Count only — names stay hidden so re-solves remain blind.
      await notifyAll("🔁 Re-solves today", `${n} re-solve${n > 1 ? "s" : ""} waiting in today's training.`, "/train");
    }
    // Sundays: the weekly review is ready.
    const weekday = new Date(now).toLocaleDateString("en-US", { weekday: "short", timeZone: s.timezone });
    if (weekday === "Sun" && once(`weekly:${d}`)) {
      await notifyAll("📅 Your weekly review is ready", "Hours vs goal, results, topics that moved, and what slowed you down.", "/review");
    }
  }
}
