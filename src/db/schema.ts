import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/** Single-row settings table (the "users" table of the spec; this is a single-user local app). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  displayName: text("display_name").notNull().default("Omar"),
  timezone: text("timezone").notNull().default("Asia/Bangkok"),
  dailyGoalMin: integer("daily_goal_min").notNull().default(120),
  shareNeetcode: integer("share_neetcode").notNull().default(60),
  shareCodeforces: integer("share_codeforces").notNull().default(25),
  shareCses: integer("share_cses").notNull().default(15),
  hintDelayMin: integer("hint_delay_min").notNull().default(30),
  editorialDelayMin: integer("editorial_delay_min").notNull().default(60),
  idlePauseMin: integer("idle_pause_min").notNull().default(10),
  resolveCap: integer("resolve_cap").notNull().default(3),
  showCfTags: integer("show_cf_tags", { mode: "boolean" }).notNull().default(false),
  contestDayFactor: real("contest_day_factor").notNull().default(0.5),
  weakEvery: integer("weak_every").notNull().default(3),
  telegramToken: text("telegram_token"),
  telegramChatId: text("telegram_chat_id"),
  clistUsername: text("clist_username"),
  clistKey: text("clist_key"),
  leetcodeSession: text("leetcode_session"),
  leetcodeCsrf: text("leetcode_csrf"),
  vapidPublic: text("vapid_public"),
  vapidPrivate: text("vapid_private"),
  atcoderTable: text("atcoder_table"), // JSON [[atcoderDiff, cfRating], ...]
  codechefTable: text("codechef_table"),
  digestHour: integer("digest_hour").notNull().default(9),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform").notNull(), // codeforces | leetcode | atcoder | codechef | cses
    handle: text("handle").notNull(),
    rating: integer("rating"),
    lastSyncedAt: integer("last_synced_at"),
    lastStatus: text("last_status"),
  },
  (t) => [uniqueIndex("accounts_platform").on(t.platform)],
);

export const problems = sqliteTable(
  "problems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    rawDifficulty: text("raw_difficulty"),
    normRating: integer("norm_rating"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    section: text("section"), // NeetCode topic / CSES section / CF contest
    solveCount: integer("solve_count"),
    acRate: real("ac_rate"),
    paidOnly: integer("paid_only", { mode: "boolean" }).notNull().default(false),
    videoUrl: text("video_url"),
    editorialUrl: text("editorial_url"),
    contestId: text("contest_id"),
    solved: integer("solved", { mode: "boolean" }).notNull().default(false),
    solvedAt: integer("solved_at"),
    solvedSource: text("solved_source"), // sync | app
  },
  (t) => [
    uniqueIndex("problems_platform_ext").on(t.platform, t.externalId),
    index("problems_rating").on(t.platform, t.normRating),
  ],
);

export const concepts = sqliteTable("concepts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  group: text("group").notNull(),
});

export const problemConcepts = sqliteTable(
  "problem_concepts",
  {
    problemId: integer("problem_id").notNull(),
    conceptId: text("concept_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.problemId, t.conceptId] }), index("pc_concept").on(t.conceptId)],
);

export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(), // neetcode250 | codeforces | cses | custom ids
  name: text("name").notNull(),
  priority: integer("priority").notNull(),
  mode: text("mode").notNull(), // ordered | progressive
  windowLo: integer("window_lo"),
  windowChangedAt: integer("window_changed_at"),
  completedAt: integer("completed_at"),
});

export const trackItems = sqliteTable(
  "track_items",
  {
    trackId: text("track_id").notNull(),
    position: integer("position").notNull(),
    problemId: integer("problem_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.trackId, t.problemId] }), index("ti_pos").on(t.trackId, t.position)],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    problemId: integer("problem_id").notNull(),
    trackId: text("track_id"),
    isResolve: integer("is_resolve", { mode: "boolean" }).notNull().default(false),
    source: text("source").notNull().default("plan"), // plan | manual | upsolve
    status: text("status").notNull().default("active"), // active | feedback | done
    phase: text("phase").notNull().default("think"), // think | stuck | code | paused
    resumePhase: text("resume_phase"),
    phaseStartedAt: integer("phase_started_at"),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    thinkSec: integer("think_sec").notNull().default(0),
    stuckSec: integer("stuck_sec").notNull().default(0),
    codeSec: integer("code_sec").notNull().default(0),
    helpUsed: text("help_used").notNull().default("none"), // none | hint | editorial
    result: text("result"), // solved | solved_help | gave_up
    felt: integer("felt"),
    slowedBy: text("slowed_by", { mode: "json" }).$type<string[]>().notNull().default([]),
    keyIdea: text("key_idea"),
    notes: text("notes"),
    timeRatio: real("time_ratio"),
    expectedMin: integer("expected_min"),
  },
  (t) => [index("attempts_problem").on(t.problemId), index("attempts_ended").on(t.endedAt)],
);

export const attemptImages = sqliteTable("attempt_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attemptId: integer("attempt_id").notNull(),
  storageKey: text("storage_key").notNull(),
  caption: text("caption"),
});

export const reviews = sqliteTable("reviews", {
  problemId: integer("problem_id").primaryKey(),
  dueDate: text("due_date").notNull(), // YYYY-MM-DD in user tz
  gapDays: real("gap_days").notNull(),
  cleanStreak: integer("clean_streak").notNull().default(0),
  status: text("status").notNull().default("queued"), // queued | retired
  lastTimeSec: integer("last_time_sec"),
  lastAttemptId: integer("last_attempt_id"),
  reps: integer("reps").notNull().default(0),
  updatedAt: integer("updated_at"),
});

export const contests = sqliteTable(
  "contests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    startUtc: integer("start_utc").notNull(), // ms
    durationSec: integer("duration_sec").notNull(),
    url: text("url").notNull(),
    joined: integer("joined", { mode: "boolean" }).notNull().default(false),
    reminded60: integer("reminded_60", { mode: "boolean" }).notNull().default(false),
    reminded10: integer("reminded_10", { mode: "boolean" }).notNull().default(false),
    upsolveDone: integer("upsolve_done", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("contests_platform_ext").on(t.platform, t.externalId)],
);

export const upsolves = sqliteTable("upsolves", {
  problemId: integer("problem_id").primaryKey(),
  contestId: integer("contest_id"),
  addedAt: integer("added_at").notNull(),
  until: text("until").notNull(), // YYYY-MM-DD; keep in daily mix until this date
  done: integer("done", { mode: "boolean" }).notNull().default(false),
});

export type PlanItem = {
  problemId: number;
  trackId: string; // neetcode250 | codeforces | cses | upsolve | review
  kind: "new" | "review" | "upsolve";
  expectedMin: number;
  done?: boolean;
  skipped?: boolean;
};

export const dailyPlans = sqliteTable("daily_plans", {
  date: text("date").primaryKey(),
  queue: text("queue", { mode: "json" }).$type<PlanItem[]>().notNull(),
  goalMin: integer("goal_min").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const conceptMastery = sqliteTable("concept_mastery", {
  conceptId: text("concept_id").primaryKey(),
  score: real("score").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastSeen: integer("last_seen"),
  weak: integer("weak", { mode: "boolean" }).notNull().default(false),
});

export const topicBoosts = sqliteTable("topic_boosts", {
  conceptId: text("concept_id").primaryKey(),
  until: text("until").notNull(),
  reason: text("reason"),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  json: text("json").notNull(),
});

export const syncLog = sqliteTable("sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at").notNull(),
  job: text("job").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  message: text("message"),
});

/** Dedupe for sent notifications (e.g. "digest:2026-11-01"). */
export const sentNotifications = sqliteTable("sent_notifications", {
  key: text("key").primaryKey(),
  at: integer("at").notNull(),
});

export type Problem = typeof problems.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Contest = typeof contests.$inferSelect;
