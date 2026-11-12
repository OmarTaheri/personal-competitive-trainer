import { recomputeRatings } from "./ratings";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { codeforces } from "@/lib/adapters/codeforces";
import { leetcode } from "@/lib/adapters/leetcode";
import { atcoder } from "@/lib/adapters/atcoder";
import { codechef } from "@/lib/adapters/codechef";
import { clistConfigured, fetchClistContests } from "@/lib/adapters/clist";
import { normUrl } from "@/lib/adapters/http";
import type { ContestUpsert, PlatformAdapter } from "@/lib/adapters/types";
import { addDays } from "@/lib/time";
import { getAccount, today } from "./settings";
import { ensureSeeded } from "./seed";

export const ADAPTERS: Record<string, PlatformAdapter> = { codeforces, leetcode, atcoder, codechef };
export const PLATFORMS = ["leetcode", "codeforces", "atcoder", "codechef"] as const;

const g = globalThis as unknown as { __cpSyncing?: Set<string> };
g.__cpSyncing ??= new Set();

function log(job: string, ok: boolean, message: string) {
  getDb().insert(schema.syncLog).values({ at: Date.now(), job, ok, message: message.slice(0, 500) }).run();
}

async function guarded(job: string, fn: () => Promise<string>): Promise<{ ok: boolean; message: string }> {
  if (g.__cpSyncing!.has(job)) return { ok: false, message: "already running" };
  g.__cpSyncing!.add(job);
  try {
    const message = await fn();
    log(job, true, message);
    return { ok: true, message };
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    log(job, false, message);
    return { ok: false, message };
  } finally {
    g.__cpSyncing!.delete(job);
  }
}

export function isSyncing() {
  return [...g.__cpSyncing!];
}

export async function syncProblems(platform: string) {
  ensureSeeded();
  const a = ADAPTERS[platform];
  if (!a?.fetchProblems) return { ok: true, message: "no problem list for this platform" };
  return guarded(`problems:${platform}`, async () => {
    const n = await a.fetchProblems!();
    // Ratings that depend on the whole batch (LeetCode percentiles) are recomputed after import.
    if (platform === "leetcode" || platform === "atcoder") recomputeRatings();
    return `${n} problems imported`;
  });
}

export async function syncSolves(platform: string) {
  ensureSeeded();
  const acc = getAccount(platform);
  const a = ADAPTERS[platform];
  if (!acc || !a?.fetchSolves) return { ok: false, message: "no handle set" };
  return guarded(`solves:${platform}`, async () => {
    const r = await a.fetchSolves!(acc.handle);
    const db = getDb();
    db.update(schema.accounts).set({ lastSyncedAt: Date.now(), lastStatus: r.note ?? "ok", rating: r.rating ?? acc.rating }).where(eq(schema.accounts.platform, platform)).run();
    if (platform === "codeforces" && r.rating) seedCfWindow(r.rating);
    return `${r.solved} solved found, ${r.newlyMarked} newly marked${r.note ? ". " + r.note : ""}`;
  });
}

/** First time a CF rating is known and no CF attempts yet: start the window at your rating. */
function seedCfWindow(rating: number) {
  const db = getDb();
  const t = db.select().from(schema.tracks).where(eq(schema.tracks.id, "codeforces")).get();
  if (!t || t.windowChangedAt) return;
  const lo = Math.max(800, Math.floor(rating / 100) * 100);
  db.update(schema.tracks).set({ windowLo: lo, windowChangedAt: Date.now() }).where(eq(schema.tracks.id, "codeforces")).run();
}

export function upsertContests(list: ContestUpsert[]) {
  const db = getDb();
  let n = 0;
  db.transaction(() => {
    for (const c of list) {
      const ext = normUrl(c.externalId);
      // Same contest from two feeds: match on platform + start time.
      const dup = db.select().from(schema.contests).where(and(eq(schema.contests.platform, c.platform), eq(schema.contests.startUtc, c.startUtc))).get();
      if (dup && dup.externalId !== ext) {
        db.update(schema.contests).set({ name: c.name, durationSec: c.durationSec }).where(eq(schema.contests.id, dup.id)).run();
        continue;
      }
      db.insert(schema.contests).values({ ...c, externalId: ext })
        .onConflictDoUpdate({ target: [schema.contests.platform, schema.contests.externalId], set: { name: c.name, startUtc: c.startUtc, durationSec: c.durationSec, url: c.url } })
        .run();
      n++;
    }
  });
  return n;
}

export async function syncContests() {
  return guarded("contests", async () => {
    const msgs: string[] = [];
    const all: ContestUpsert[] = [];
    const covered = new Set<string>();
    if (clistConfigured()) {
      try {
        const l = await fetchClistContests();
        all.push(...l);
        PLATFORMS.forEach((p) => covered.add(p));
        msgs.push(`clist ${l.length}`);
      } catch (e) {
        msgs.push(`clist failed: ${(e as Error).message}`);
      }
    }
    // Native feeds always for CF + LeetCode (cheap, official/stable); others only as fallback.
    for (const p of PLATFORMS) {
      const a = ADAPTERS[p];
      if (!a.fetchContests) continue;
      if (covered.has(p) && p !== "codeforces" && p !== "leetcode") continue;
      try {
        const l = await a.fetchContests();
        all.push(...l);
        msgs.push(`${p} ${l.length}`);
      } catch (e) {
        msgs.push(`${p} failed: ${(e as Error).message}`);
      }
    }
    const n = upsertContests(all);
    return `${n} contests (${msgs.join(", ")})`;
  });
}

/** After a joined contest ends, unsolved problems go to the Upsolve list for the next few days. */
export async function syncUpsolves() {
  const db = getDb();
  const now = Date.now();
  const ended = db
    .select()
    .from(schema.contests)
    .where(and(eq(schema.contests.joined, true), eq(schema.contests.upsolveDone, false), lte(sql`${schema.contests.startUtc} + ${schema.contests.durationSec} * 1000`, now - 15 * 60e3)))
    .all();
  for (const c of ended) {
    const a = ADAPTERS[c.platform];
    if (!a?.fetchContestProblems) {
      db.update(schema.contests).set({ upsolveDone: true }).where(eq(schema.contests.id, c.id)).run();
      continue;
    }
    await guarded(`upsolve:${c.id}`, async () => {
      if (c.platform === "codeforces" || c.platform === "atcoder" || c.platform === "leetcode") await syncSolves(c.platform).catch(() => null);
      const handle = getAccount(c.platform)?.handle ?? null;
      const probs = await a.fetchContestProblems!({ externalId: c.externalId, url: c.url }, handle);
      const until = addDays(today(), 4);
      let added = 0;
      for (const p of probs) {
        if (p.solved) continue;
        db.insert(schema.upsolves).values({ problemId: p.problemId, contestId: c.id, addedAt: now, until }).onConflictDoNothing().run();
        added++;
      }
      db.update(schema.contests).set({ upsolveDone: true }).where(eq(schema.contests.id, c.id)).run();
      return `${c.name}: ${added} upsolve problems`;
    });
  }
}

export async function syncAll(kind: "all" | "solves" | "problems" | "contests" = "all") {
  ensureSeeded();
  const results: Record<string, { ok: boolean; message: string }> = {};
  if (kind === "all" || kind === "problems") {
    for (const p of ["leetcode", "codeforces", "atcoder"]) results[`problems:${p}`] = await syncProblems(p);
  }
  if (kind === "all" || kind === "solves") {
    for (const p of PLATFORMS) if (getAccount(p)) results[`solves:${p}`] = await syncSolves(p);
  }
  if (kind === "all" || kind === "contests") {
    results.contests = await syncContests();
  }
  return results;
}

export function recentSyncLog(limit = 30) {
  return getDb().select().from(schema.syncLog).orderBy(desc(schema.syncLog.at)).limit(limit).all();
}

export function upcomingContests(limit = 50, fromMs = Date.now() - 3 * 3600e3) {
  return getDb().select().from(schema.contests).where(gte(sql`${schema.contests.startUtc} + ${schema.contests.durationSec} * 1000`, fromMs)).orderBy(asc(schema.contests.startUtc)).limit(limit).all();
}

export function contestsBetween(fromMs: number, toMs: number) {
  return getDb().select().from(schema.contests).where(and(gte(schema.contests.startUtc, fromMs), lte(schema.contests.startUtc, toMs))).orderBy(asc(schema.contests.startUtc)).all();
}

export function lastSyncAt(prefix: string): number | null {
  const r = getDb().select().from(schema.syncLog).where(and(sql`${schema.syncLog.job} like ${prefix + "%"}`, eq(schema.syncLog.ok, true))).orderBy(desc(schema.syncLog.at)).get();
  return r?.at ?? null;
}
