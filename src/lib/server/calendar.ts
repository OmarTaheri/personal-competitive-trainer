import { and, gte, lte, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { contestsBetween } from "@/lib/server/sync";

export type CalEvent = { id: string; kind: "contest" | "training"; platform: string; title: string; start: number; end: number; url?: string; joined?: boolean; contestId?: number; result?: string | null };

export function calendarEvents(from: number, to: number): CalEvent[] {
  const contests = contestsBetween(from - 86400e3, to).map<CalEvent>((c) => ({
    id: `c${c.id}`, kind: "contest", platform: c.platform, title: c.name, start: c.startUtc, end: c.startUtc + c.durationSec * 1000, url: c.url, joined: c.joined, contestId: c.id,
  }));
  const rows = getDb().select({ a: schema.attempts, p: schema.problems }).from(schema.attempts)
    .innerJoin(schema.problems, eq(schema.problems.id, schema.attempts.problemId))
    .where(and(gte(schema.attempts.startedAt, from), lte(schema.attempts.startedAt, to))).all();
  const sessions = rows.map<CalEvent>(({ a, p }) => ({
    id: `a${a.id}`, kind: "training", platform: p.platform, title: p.title, start: a.startedAt,
    end: a.endedAt ?? Date.now(), url: p.url, result: a.result,
  }));
  return [...contests, ...sessions].filter((e) => e.end >= from && e.start <= to);
}

