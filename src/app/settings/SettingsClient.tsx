"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, PLATFORM_META, refreshHeader } from "@/lib/ui";

type S = {
  displayName: string; timezone: string; dailyGoalMin: number; shareNeetcode: number; shareCodeforces: number; shareCses: number;
  hintDelayMin: number; editorialDelayMin: number; idlePauseMin: number; resolveCap: number; showCfTags: boolean; contestDayFactor: number;
  weakEvery: number; digestHour: number; telegramChatId: string; clistUsername: string; atcoderTable: string; codechefTable: string;
};
type Account = { platform: string; handle: string; rating: number | null; lastSyncedAt: number | null; lastStatus: string | null };
type Log = { id: number; at: number; job: string; ok: boolean; message: string | null };

const PLATFORMS = ["leetcode", "codeforces", "atcoder", "codechef"] as const;
const HANDLE_HELP: Record<string, string> = {
  leetcode: "Public profile username — last 20 accepted solves sync without login.",
  codeforces: "Official API. Syncs solves + rating; rating sets your starting CF window.",
  atcoder: "Uses kenkoooo's AtCoder Problems API.",
  codechef: "Best-effort profile scraping (no public API).",
};

export default function SettingsClient({ settings, secrets, accounts, log: initialLog, counts }: {
  settings: S; secrets: Record<string, string>; accounts: Account[]; log: Log[]; counts: { platform: string; total: number; solved: number }[];
}) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [handles, setHandles] = useState<Record<string, string>>(Object.fromEntries(PLATFORMS.map((p) => [p, accounts.find((a) => a.platform === p)?.handle ?? ""])));
  const [sec, setSec] = useState<Record<string, string>>({ telegramToken: "", clistKey: "", leetcodeSession: "", leetcodeCsrf: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [log, setLog] = useState(initialLog);
  const [running, setRunning] = useState<string[]>([]);
  const [csv, setCsv] = useState("");
  const [csesHtml, setCsesHtml] = useState("");

  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 5000); };

  // Poll sync status while something runs.
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await api<{ running: string[]; log: Log[] }>("/api/sync").catch(() => null);
      if (r) { setRunning(r.running); setLog(r.log); }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }));
  const shareSum = s.shareNeetcode + s.shareCodeforces + s.shareCses;

  const save = async () => {
    try {
      const secretPatch = Object.fromEntries(Object.entries(sec).filter(([, v]) => v.trim() !== ""));
      await api("/api/settings", { ...s, ...secretPatch, accounts: handles, rebuild: true });
      setSec({ telegramToken: "", clistKey: "", leetcodeSession: "", leetcodeCsrf: "" });
      flash(true, "Saved. Today's plan was rebuilt with the new settings.");
      refreshHeader();
      router.refresh();
    } catch (e) { flash(false, (e as Error).message); }
  };

  const clearSecret = async (k: string) => {
    await api("/api/settings", { [k]: "" });
    flash(true, "Cleared.");
    router.refresh();
  };

  const sync = async (kind: string, platform?: string) => {
    await api("/api/sync", { kind, platform });
    setRunning((r) => [...r, `${kind}${platform ? ":" + platform : ""}`]);
    flash(true, "Sync started — results show in the log below.");
  };

  const enablePush = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support push notifications");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notification permission denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/push");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(publicKey) });
      await api("/api/push", sub.toJSON());
      flash(true, "Browser notifications enabled.");
    } catch (e) { flash(false, (e as Error).message); }
  };

  const enableIdle = async () => {
    try {
      const W = window as unknown as { IdleDetector?: { requestPermission: () => Promise<string> } };
      if (!W.IdleDetector) throw new Error("System idle detection is only available in Chrome/Edge");
      const r = await W.IdleDetector.requestPermission();
      flash(r === "granted", r === "granted" ? "System idle detection on — the timer pauses even when you're on the problem tab." : "Permission denied");
    } catch (e) { flash(false, (e as Error).message); }
  };

  const test = async (channel: string) => {
    try { const r = await api<{ message: string }>("/api/notify", { channel }); flash(true, r.message); } catch (e) { flash(false, (e as Error).message); }
  };

  const doImport = async (kind: string, text: string) => {
    try { const r = await api<{ message: string }>("/api/import", { kind, text }); flash(true, r.message); router.refresh(); } catch (e) { flash(false, (e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Section title="Linked accounts" desc="Problems you already solved on each platform get marked, so the planner never serves them as new.">
        <div className="grid gap-4 md:grid-cols-2">
          {PLATFORMS.map((p) => {
            const acc = accounts.find((a) => a.platform === p);
            const m = PLATFORM_META[p];
            const busy = running.some((r) => r.includes(p));
            return (
              <div key={p} className="rounded-md border border-line bg-panel2 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: m.color }}>{m.short}</span>
                  <span className="font-semibold">{m.label}</span>
                  {acc?.rating ? <span className="chip ml-auto !text-xs">rating {acc.rating}</span> : null}
                </div>
                <input className="input mt-3" placeholder="handle / username" value={handles[p]} onChange={(e) => setHandles((h) => ({ ...h, [p]: e.target.value }))} />
                <div className="mt-1.5 text-xs text-dim">{HANDLE_HELP[p]}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-mute">{acc?.lastSyncedAt ? `Synced ${new Date(acc.lastSyncedAt).toLocaleString()}` : "Not synced yet"}</span>
                  <button className="btn !px-3 !py-1 !text-xs" disabled={!acc || busy} onClick={() => sync("solves", p)}>{busy ? "Syncing…" : "Sync solves"}</button>
                </div>
                {acc?.lastStatus && acc.lastStatus !== "ok" && <div className="mt-2 text-xs text-amber">{acc.lastStatus}</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Secret label="LeetCode session cookie (LEETCODE_SESSION)" hint="Optional: unlocks your full solve history. DevTools → Application → Cookies → leetcode.com. Stored only in your local database." masked={secrets.leetcodeSession} value={sec.leetcodeSession} onChange={(v) => setSec((x) => ({ ...x, leetcodeSession: v }))} onClear={() => clearSecret("leetcodeSession")} />
          <Secret label="LeetCode csrftoken cookie" hint="Optional, sent alongside the session cookie." masked={secrets.leetcodeCsrf} value={sec.leetcodeCsrf} onChange={(v) => setSec((x) => ({ ...x, leetcodeCsrf: v }))} onClear={() => clearSecret("leetcodeCsrf")} />
        </div>
      </Section>

      <Section title="clist.by (contests from every platform)" desc="Free account at clist.by → your profile → API. Without it, contests come from Codeforces, LeetCode, AtCoder and CodeChef directly.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="clist username"><input className="input" value={s.clistUsername} onChange={(e) => set("clistUsername", e.target.value)} /></Field>
          <Secret label="clist API key" masked={secrets.clistKey} value={sec.clistKey} onChange={(v) => setSec((x) => ({ ...x, clistKey: v }))} onClear={() => clearSecret("clistKey")} />
        </div>
      </Section>

      <Section title="Daily goal & tracks" desc="Shares are minutes, not problem counts. When NeetCode 250 hits 100% its share moves to Codeforces.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Name"><input className="input" value={s.displayName} onChange={(e) => set("displayName", e.target.value)} /></Field>
          <Field label="Daily goal (minutes)"><Num v={s.dailyGoalMin} on={(v) => set("dailyGoalMin", v)} /></Field>
          <Field label="Time zone"><input className="input" value={s.timezone} onChange={(e) => set("timezone", e.target.value)} list="tzs" /></Field>
          <Field label="Contest-day goal factor"><Num v={s.contestDayFactor} step={0.1} on={(v) => set("contestDayFactor", v)} /></Field>
        </div>
        <datalist id="tzs">{["Asia/Bangkok", "UTC", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Asia/Dubai", "Asia/Riyadh", "Asia/Kolkata"].map((t) => <option key={t} value={t} />)}</datalist>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Share label="NeetCode 250" color="#4ba0f2" v={s.shareNeetcode} on={(v) => set("shareNeetcode", v)} />
          <Share label="Codeforces" color="#6aa56f" v={s.shareCodeforces} on={(v) => set("shareCodeforces", v)} />
          <Share label="CSES" color="#4ba0f2" v={s.shareCses} on={(v) => set("shareCses", v)} />
        </div>
        {shareSum !== 100 && <div className="mt-2 text-sm text-amber">Shares add up to {shareSum}% — they're normalized, but 100% is easier to read.</div>}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label="Weak-topic slot: every Nth NeetCode problem (0 = off)"><Num v={s.weakEvery} on={(v) => set("weakEvery", v)} /></Field>
          <Field label="Re-solves per day (cap)"><Num v={s.resolveCap} on={(v) => set("resolveCap", v)} /></Field>
          <Field label="Codeforces tags while solving">
            <button className={`btn w-full ${s.showCfTags ? "!border-green/60 text-green" : ""}`} onClick={() => set("showCfTags", !s.showCfTags)}>{s.showCfTags ? "Shown" : "Hidden (contest mode)"}</button>
          </Field>
        </div>
      </Section>

      <Section title="Timer & help ladder" desc="Help unlocks by time spent in the Stuck phase.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Hint after (min stuck)"><Num v={s.hintDelayMin} on={(v) => set("hintDelayMin", v)} /></Field>
          <Field label="Video / editorial after (min stuck)"><Num v={s.editorialDelayMin} on={(v) => set("editorialDelayMin", v)} /></Field>
          <Field label="Auto-pause after (min idle, 0 = off)"><Num v={s.idlePauseMin} on={(v) => set("idlePauseMin", v)} /></Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button className="btn" onClick={enableIdle}>Enable system idle detection</button>
          <span className="text-sm text-dim">Without it, idle is only detected while this tab is focused.</span>
        </div>
      </Section>

      <Section title="Notifications" desc="Contest reminders 1 hour and 10 minutes before, plus a daily count of re-solves (no names).">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={enablePush}>Enable browser notifications</button>
          <button className="btn" onClick={() => test("push")}>Send test</button>
          <Field label="Daily digest hour"><Num v={s.digestHour} on={(v) => set("digestHour", v)} /></Field>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Secret label="Telegram bot token" hint="Create a bot with @BotFather and paste its token." masked={secrets.telegramToken} value={sec.telegramToken} onChange={(v) => setSec((x) => ({ ...x, telegramToken: v }))} onClear={() => clearSecret("telegramToken")} />
          <Field label="Telegram chat id" hint="Message your bot once, then open api.telegram.org/bot<TOKEN>/getUpdates and copy chat.id.">
            <input className="input" value={s.telegramChatId} onChange={(e) => set("telegramChatId", e.target.value)} />
          </Field>
        </div>
        <button className="btn mt-3" onClick={() => test("telegram")}>Send Telegram test</button>
      </Section>

      <Section title="Problem bank & sync" desc="Runs automatically: problems + solves every 6 h, contests every hour.">
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => <span key={c.platform} className="chip">{PLATFORM_META[c.platform]?.label ?? c.platform}: {c.total.toLocaleString()} problems · {c.solved ?? 0} solved</span>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => sync("all")}>Sync everything now</button>
          <button className="btn" onClick={() => sync("solves")}>Sync solves</button>
          <button className="btn" onClick={() => sync("contests")}>Sync contests</button>
          {["leetcode", "codeforces", "atcoder"].map((p) => <button key={p} className="btn" onClick={() => sync("problems", p)}>Import {PLATFORM_META[p].label} problems</button>)}
        </div>
        {running.length > 0 && <div className="mt-3 text-sm text-accent">Running: {running.join(", ")}</div>}
        <div className="mt-4 max-h-72 overflow-auto rounded-md border border-line scroll-thin">
          <table className="tbl"><tbody>
            {log.map((l) => (
              <tr key={l.id}><td className="whitespace-nowrap text-mute">{new Date(l.at).toLocaleString()}</td><td className="whitespace-nowrap">{l.job}</td><td className={l.ok ? "text-green" : "text-red"}>{l.ok ? "ok" : "failed"}</td><td className="text-mute">{l.message}</td></tr>
            ))}
            {!log.length && <tr><td className="text-dim">No syncs yet.</td></tr>}
          </tbody></table>
        </div>
      </Section>

      <Section title="Imports" desc="Curated lists import as tracks; CSES progress can be imported from its problem page.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Field label="Replace NeetCode 250 track from CSV" hint="Columns: position,topic,title,difficulty,slug[,leetcode_url,video]. The bundled list is data/seed/neetcode250.csv.">
              <textarea className="input min-h-28 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="position,topic,title,difficulty,slug" />
            </Field>
            <button className="btn mt-2" disabled={!csv.trim()} onClick={() => doImport("neetcode", csv)}>Import CSV</button>
          </div>
          <div>
            <Field label="CSES solved problems" hint="Log in at cses.fi/problemset, press Ctrl+U (view source), select all, paste here.">
              <textarea className="input min-h-28 font-mono text-xs" value={csesHtml} onChange={(e) => setCsesHtml(e.target.value)} placeholder="<html>…" />
            </Field>
            <button className="btn mt-2" disabled={!csesHtml.trim()} onClick={() => doImport("cses", csesHtml)}>Import CSES progress</button>
          </div>
        </div>
      </Section>

      <Section title="Rating normalization" desc="Lookup tables [[platform difficulty, Codeforces rating], …]; linear in between. LeetCode: Easy 800–1100, Medium 1200–1700, Hard 1800–2400, placed by acceptance-rate percentile within the difficulty. CSES: section band by solver count.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="AtCoder difficulty → CF"><textarea className="input min-h-20 font-mono text-xs" value={s.atcoderTable} onChange={(e) => set("atcoderTable", e.target.value)} /></Field>
          <Field label="CodeChef difficulty → CF"><textarea className="input min-h-20 font-mono text-xs" value={s.codechefTable} onChange={(e) => set("codechefTable", e.target.value)} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn" onClick={() => sync("ratings")}>Recompute all ratings</button>
          <span className="text-xs text-dim">Save first if you changed a table. Also runs after every LeetCode / AtCoder import.</span>
        </div>
      </Section>

      <Section title="Backup">
        <a className="btn" href="/api/export">Download database backup</a>
      </Section>

      <ResetCard onDone={() => { flash(true, "Progress reset. Fresh start!"); refreshHeader(); router.refresh(); }} onError={(m) => flash(false, m)} />

      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {msg && <div className={`rounded-xl border px-4 py-2 text-sm shadow-xl ${msg.ok ? "border-green/50 bg-[#34413a] text-green" : "border-red/50 bg-[#463434] text-red"}`}>{msg.text}</div>}
        <button className="btn btn-primary !px-8 !py-4 !text-lg shadow-2xl" onClick={save}>Save settings</button>
      </div>
    </div>
  );
}

function ResetCard({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api("/api/reset", { confirm: typed }); setTyped(""); onDone(); }
    catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section className="card card-pad !border-red/40">
      <h2 className="text-xl font-bold text-red">Danger zone · Reset all progress</h2>
      <p className="mt-1 text-sm text-mute">
        Deletes every attempt, note and image, the re-solve schedule, weak-topic scores, XP / level and today&apos;s plan. Problems solved on your linked
        accounts (LeetCode, Codeforces, …) stay solved. Download a backup first if you might want it back.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input className="input !w-56 font-mono" placeholder="type RESET" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button className="btn !border-red/60 text-red disabled:opacity-40" disabled={typed !== "RESET" || busy} onClick={go}>{busy ? "Resetting…" : "Reset all progress"}</button>
      </div>
    </section>
  );
}

function urlB64(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad">
      <h2 className="text-xl font-bold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-mute">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

function Num({ v, on, step = 1 }: { v: number; on: (v: number) => void; step?: number }) {
  return <input type="number" step={step} className="input" value={v} onChange={(e) => on(Number(e.target.value))} />;
}

function Share({ label, color, v, on }: { label: string; color: string; v: number; on: (v: number) => void }) {
  return (
    <div className="rounded-md border border-line bg-panel2 p-4">
      <div className="flex justify-between"><span>{label}</span><b style={{ color }}>{v}%</b></div>
      <input type="range" min={0} max={100} value={v} onChange={(e) => on(Number(e.target.value))} className="mt-2 w-full" style={{ accentColor: color }} />
    </div>
  );
}

function Secret({ label, hint, masked, value, onChange, onClear }: { label: string; hint?: string; masked: string; value: string; onChange: (v: string) => void; onClear: () => void }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <input type="password" className="input" placeholder={masked ? `saved ${masked}` : "not set"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
        {masked && <button type="button" className="btn !px-3" onClick={onClear}>Clear</button>}
      </div>
    </Field>
  );
}
