import { NextResponse } from "next/server";
import { z } from "zod";
import { setAccount, updateSettings } from "@/lib/server/settings";
import { rebuildPlan } from "@/lib/server/training";
import { syncSolves } from "@/lib/server/sync";

const Table = z.array(z.tuple([z.number(), z.number()])).min(2);
const isTable = (s: string) => { try { return Table.safeParse(JSON.parse(s)).success; } catch { return false; } };

const Body = z.object({
  displayName: z.string().min(1).max(40).optional(),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown time zone").optional(),
  dailyGoalMin: z.number().int().min(10).max(960).optional(),
  shareNeetcode: z.number().int().min(0).max(100).optional(),
  shareCodeforces: z.number().int().min(0).max(100).optional(),
  shareCses: z.number().int().min(0).max(100).optional(),
  hintDelayMin: z.number().int().min(0).max(240).optional(),
  editorialDelayMin: z.number().int().min(0).max(480).optional(),
  idlePauseMin: z.number().int().min(0).max(120).optional(),
  resolveCap: z.number().int().min(0).max(20).optional(),
  showCfTags: z.boolean().optional(),
  contestDayFactor: z.number().min(0).max(1).optional(),
  weakEvery: z.number().int().min(0).max(10).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  telegramToken: z.string().nullable().optional(),
  telegramChatId: z.string().nullable().optional(),
  clistUsername: z.string().nullable().optional(),
  clistKey: z.string().nullable().optional(),
  leetcodeSession: z.string().nullable().optional(),
  leetcodeCsrf: z.string().nullable().optional(),
  atcoderTable: z.string().refine(isTable, "Table must be [[x, cf], ...]").optional(),
  codechefTable: z.string().refine(isTable, "Table must be [[x, cf], ...]").optional(),
  accounts: z.record(z.string(), z.string()).optional(),
  rebuild: z.boolean().optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  const { accounts, rebuild, ...rest } = parsed.data;
  // Empty strings clear secrets.
  const clean = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v]));
  if (Object.keys(clean).length) updateSettings(clean);
  const changedHandles: string[] = [];
  if (accounts) for (const [platform, handle] of Object.entries(accounts)) { setAccount(platform, handle); if (handle.trim()) changedHandles.push(platform); }
  if (rebuild) rebuildPlan();
  // Kick off a solves sync for handles that were just set (non-blocking).
  for (const p of changedHandles) void syncSolves(p);
  return NextResponse.json({ ok: true });
}
