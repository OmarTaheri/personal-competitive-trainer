import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/db";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) cp-training/0.1 (personal practice tracker)";

/** Simple sliding-window limiter: at most `max` calls per `windowMs`. */
export class RateLimiter {
  private stamps: number[] = [];
  constructor(private max: number, private windowMs: number) {}
  async wait() {
    for (;;) {
      const now = Date.now();
      this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
      if (this.stamps.length < this.max) { this.stamps.push(now); return; }
      await sleep(this.windowMs - (now - this.stamps[0]) + 5);
    }
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CACHE_DIR = path.join(DATA_DIR, "cache");

function cachePath(key: string) {
  return path.join(CACHE_DIR, crypto.createHash("sha1").update(key).digest("hex") + ".json");
}

export type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  ttlMs?: number; // cache successful responses for this long
  limiter?: RateLimiter;
  text?: boolean;
  timeoutMs?: number;
};

export async function fetchData<T = unknown>(url: string, o: FetchOpts = {}): Promise<T> {
  const key = `${o.method ?? "GET"} ${url} ${o.body ?? ""} ${o.headers?.cookie ? "auth" : ""}`;
  if (o.ttlMs) {
    try {
      const f = cachePath(key);
      const st = fs.statSync(f);
      if (Date.now() - st.mtimeMs < o.ttlMs) return JSON.parse(fs.readFileSync(f, "utf8")) as T;
    } catch { /* miss */ }
  }
  await o.limiter?.wait();
  const res = await fetch(url, {
    method: o.method ?? "GET",
    headers: { "user-agent": UA, accept: o.text ? "text/html,*/*" : "application/json", ...o.headers },
    body: o.body,
    signal: AbortSignal.timeout(o.timeoutMs ?? 30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.split("?")[0]}`);
  const data = (o.text ? await res.text() : await res.json()) as T;
  if (o.ttlMs) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(key), JSON.stringify(data));
  }
  return data;
}

export function normUrl(u: string): string {
  return u.trim().toLowerCase().replace(/^http:\/\//, "https://").replace("://www.", "://").replace(/\/+$/, "");
}
