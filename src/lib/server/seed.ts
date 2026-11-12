import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { CONCEPTS, NEETCODE_TOPIC_MAP, CSES_SECTION_MAP, CSES_TRACK_SECTIONS } from "@/lib/concepts";
import { leetcodeRating, csesRating } from "@/lib/engine/rating";
import { ensureRatingsCurrent } from "./ratings";
import { upsertProblem, setConcepts } from "./problems";
import { getSettings } from "./settings";

const SEED_DIR = path.join(process.cwd(), "data", "seed");

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

export type NeetcodeRow = { position: number; topic: string; title: string; difficulty: string; slug: string; leetcode_url: string; video: string };

export function readNeetcode(): NeetcodeRow[] {
  return parseCsv(fs.readFileSync(path.join(SEED_DIR, "neetcode250.csv"), "utf8")).map((r) => ({ ...r, position: Number(r.position) }) as NeetcodeRow);
}

/** Import (or re-import) a track from a CSV with columns position,topic,title,difficulty,slug,leetcode_url,video. */
export function importNeetcodeTrack(rows: NeetcodeRow[]) {
  const db = getDb();
  db.transaction(() => {
    db.delete(schema.trackItems).where(eq(schema.trackItems.trackId, "neetcode250")).run();
    for (const r of rows) {
      const id = upsertProblem({
        platform: "leetcode",
        externalId: r.slug,
        title: r.title,
        url: r.leetcode_url || `https://leetcode.com/problems/${r.slug}/`,
        rawDifficulty: r.difficulty,
        section: r.topic,
        videoUrl: r.video || null,
        editorialUrl: `https://leetcode.com/problems/${r.slug}/editorial/`,
      });
      // Keep a synced acRate-based rating if present; otherwise band middle.
      const p = db.select({ n: schema.problems.normRating, ac: schema.problems.acRate }).from(schema.problems).where(eq(schema.problems.id, id)).get()!;
      db.update(schema.problems).set({ normRating: leetcodeRating(r.difficulty, p.ac) }).where(eq(schema.problems.id, id)).run();
      setConcepts(id, NEETCODE_TOPIC_MAP[r.topic] ?? []);
      db.insert(schema.trackItems).values({ trackId: "neetcode250", position: r.position, problemId: id }).run();
    }
  });
}

function seedCses() {
  const db = getDb();
  const list = JSON.parse(fs.readFileSync(path.join(SEED_DIR, "cses.json"), "utf8")) as { id: string; title: string; section: string; solvers: number }[];
  const bySection = new Map<string, typeof list>();
  for (const p of list) bySection.set(p.section, [...(bySection.get(p.section) ?? []), p]);
  db.transaction(() => {
    db.delete(schema.trackItems).where(eq(schema.trackItems.trackId, "cses")).run();
    let pos = 0;
    const order = [...CSES_TRACK_SECTIONS, ...[...bySection.keys()].filter((s) => !CSES_TRACK_SECTIONS.includes(s))];
    for (const section of order) {
      const items = [...(bySection.get(section) ?? [])].sort((a, b) => b.solvers - a.solvers);
      items.forEach((p, rank) => {
        const id = upsertProblem({
          platform: "cses",
          externalId: p.id,
          title: p.title,
          url: `https://cses.fi/problemset/task/${p.id}`,
          rawDifficulty: section,
          normRating: csesRating(section, rank, items.length),
          section,
          solveCount: p.solvers,
          tags: [section],
        });
        setConcepts(id, CSES_SECTION_MAP[section] ?? []);
        // Only the main sections are in the progressive track.
        if (CSES_TRACK_SECTIONS.includes(section)) db.insert(schema.trackItems).values({ trackId: "cses", position: ++pos, problemId: id }).run();
      });
    }
  });
}

let seeded = false;

export function ensureSeeded() {
  if (seeded) return;
  const db = getDb();
  getSettings();
  db.insert(schema.concepts).values(CONCEPTS).onConflictDoNothing().run();
  const tracks = [
    { id: "neetcode250", name: "NeetCode 250", priority: 1, mode: "ordered" },
    { id: "codeforces", name: "Codeforces", priority: 2, mode: "progressive", windowLo: 800 },
    { id: "cses", name: "CSES", priority: 3, mode: "progressive" },
  ];
  db.insert(schema.tracks).values(tracks).onConflictDoNothing().run();
  const nc = db.select({ n: sql<number>`count(*)` }).from(schema.trackItems).where(eq(schema.trackItems.trackId, "neetcode250")).get()!.n;
  if (nc === 0) importNeetcodeTrack(readNeetcode());
  const cs = db.select({ n: sql<number>`count(*)` }).from(schema.trackItems).where(eq(schema.trackItems.trackId, "cses")).get()!.n;
  if (cs === 0) seedCses();
  ensureRatingsCurrent();
  seeded = true;
}
