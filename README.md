# CP Training

A personal competitive-programming trainer that runs on your PC. It combines NeetCode 250, Codeforces and CSES into one daily plan, times every attempt, schedules re-solves so ideas stick, finds your weak topics and gives you more of them. You are the character who levels up.

## Run it

```bash
npm install          # first time only
npm run dev          # then open http://localhost:3000
```

Everything is stored in `data/app.db` (SQLite) and `data/uploads/` (your images). Settings → Backup downloads a copy of the database.

## First 5 minutes

1. **Settings → Linked accounts**: enter your LeetCode username (and Codeforces / AtCoder / CodeChef if you have them), then **Save settings**. Solves sync right away, and problems you already solved are never served as new.
   - LeetCode only shows your last 20 accepted solves publicly. To sync your full history, paste your `LEETCODE_SESSION` cookie.
2. **clist.by key** (optional): adds every platform's contests to one feed. Without it, contests come straight from Codeforces, LeetCode, AtCoder and CodeChef.
3. **Notifications**: click *Enable browser notifications*, and/or add a Telegram bot token and chat id, then *Send test*.
4. Set your **daily goal** in minutes, then press **TRAIN NOW** on Home.

## How "Today" is built

| Order | What | Rule |
|---|---|---|
| 1 | Re-solves due | Max 3/day (setting). The oldest are taken first and the rest roll over. Mixed in with new problems and look exactly like them. |
| 2 | NeetCode 250 (60% of minutes) | Next unsolved in list order. **Every 3rd slot** takes the next unsolved list problem from your **weakest topic**, so the list still gets finished. |
| 3 | Codeforces (25%) | Random unsolved in `[window, window+200]`. Weak topics and a just-finished NeetCode topic count twice when picking. |
| 4 | CSES (15%) | Intro → Sorting → DP → Graphs → Range → Trees → Math. Most-solved problems come first. |

- Shares are **minutes**, using expected time. Defaults: LeetCode Easy 20 / Medium 40 / Hard 60; rated problems 800 → 20, 1200 → 30, 1600 → 45, 2000 → 65, 2400 → 90 min. **Once you have 5 solves in a band** (a LeetCode difficulty, or a 200-rating band like 1200–1399), your own median time replaces the default. This is also what "slow" (> 1.5× expected) is measured against.
- Contest problems are **never** added to training.
- **Contests:** mark the ones you'll take with "+ I'll join" (Home strip or the Calendar). Only joined contests send reminders (1 h and 10 min before), and that day's goal is ×0.5.
- **Never runs out.** Past your goal, more problems are added automatically (bonus round).
- **Adapts after every problem.** The rest of today's list is rebuilt each time you save feedback:
  - Struggled (needed help, gave up, or took > 1.5× the expected time)? The very next NeetCode pick is the next unsolved *list* problem of that same concept, and that concept counts double for Codeforces / CSES picks today.
  - On a roll (fast, clean, felt easy, several times in a row)? The next NeetCode pick jumps to the next Medium/Hard in the list, and today's Codeforces picks move up to +200.
  - Struggling repeatedly? Today's Codeforces picks move down (never below 800). The stored CF window still only changes by the 7/10 rule.
- **Today's suggestions** (button on the training screen, link on Home) shows the current list. Re-solves look exactly like new problems there too.
- When NeetCode 250 reaches 100%, its share moves to Codeforces.
- **Codeforces window**: starts at your CF rating (or 800). It moves up 100 after ≥7 of your last 10 are solved without the editorial, and down 100 after <4.

## Training flow

Training is a full-screen focus mode (no sidebar): the problem title in the middle, chips above, timer and buttons below. **✕ Quit** (top right) is the only way out. It pauses a running timer, and during feedback it saves first.

**START** opens the problem on LeetCode/CF/CSES in a new tab and starts the timer. The timer has three phases: **Thinking**, **Stuck**, **Coding**. It auto-pauses after 10 min idle (enable system idle detection in Settings so this also works while you're on the problem tab).

Help unlocks by stuck time: **hint after 30 min** (LeetCode's own hints, or the hidden CF tags), **video/editorial after 60 min**.

Finish with **Solved / Solved with help / Gave up**. Then a 30-second form: how hard it felt (1–5), the key idea (required), what slowed you down, notes, and images (drop, paste with Ctrl+V, or choose a file). **Save & next** shows the next problem straight away, until you press Quit.

**Re-solves are blind.** Nothing tells you you've seen a problem before. After you finish, your old key idea, notes and images appear next to the new result so you can compare.

## Re-solve schedule (spaced repetition)

| How it went | First re-solve |
|---|---|
| Gave up / read the solution | **one retry later the same day** (after 3 other problems or 90 min, unmarked), then 1 day |
| Solved with help | 3 days |
| Alone, felt 4–5 or > 1.5× expected time | 5 days |
| Alone, felt 3 | 10 days |
| Alone, felt 1–2, under expected time | 30 days |

After each re-solve: alone and faster → gap ×2.5; slower or with help → ×1.2; failed → 1 day. A problem in a **weak topic** gets its gap ×0.7. There's ±10% jitter so re-solves don't bunch up. A problem retires after 2 clean re-solves following 30+ day gaps (it stays in the Log).

## Weak topics

Every attempt updates a 0–100 score for each concept the problem belongs to (moving average). Solved alone counts 1, with help 0.5, gave up 0. Felt 4–5, slow, or "didn't know the topic" lowers it. **Weak = score < 60 after 3+ attempts, or 2 struggles in a row** (help, gave up, or > 1.5× expected time). Weak topics show red on your character and on Home, pull NeetCode problems forward, count double for CF/CSES picks, and shorten re-solve gaps.

## Weekly review

Sidebar → Weekly review (a reminder is sent on Sundays). For any week: hours vs goal per day, results (alone / with help / gave up), topics that got better or worse vs the 4 weeks before, what slowed you down most with a tip, re-solves faster or slower than last time, and your personal expected times per band.

## Character

XP = minutes × difficulty + a bonus per solve. You start with nothing but plain shorts; every piece of gear is earned: T-shirt (LV 2), joggers (3), sneakers (4), headband (5), wristband (7), hoodie (10), headphones (15), aura (20), laptop (25), golden sneakers (30). The dots on the body are your concept groups: green strong, orange learning, red weak.

## NeetCode page

Two views: **Tree** (the roadmap: arrows show which topic comes after which; a dashed topic means "finish its prerequisites first"; click a topic for its problems) and **List** (topics you open and close).

## Rating normalization (everything on the Codeforces scale)

| Platform | Rule |
|---|---|
| Codeforces | As is |
| LeetCode | Easy 800–1100, Medium 1200–1700, Hard 1800–2400. Inside the band by acceptance-rate percentile among problems of the same difficulty (most accepted = bottom) |
| AtCoder | kenkoooo difficulty through a table (ABC C ≈ 1000–1200, D ≈ 1300–1500, E ≈ 1600–1800, F ≈ 1900–2200). AtCoder Daily Training copies are skipped |
| CSES | Section band (e.g. Introductory 800–1600, Graphs 1200–2300), placed by solver count |
| CodeChef | Table (CodeChef ratings run ~300 higher than CF) |

Tables are editable in Settings. Settings → **Recompute all ratings** re-applies the rules.

## Reset

Settings → Danger zone → type `RESET`. Deletes attempts, notes, images, the re-solve schedule, weak-topic scores, XP and plans. Problems solved on your linked accounts stay solved.

## Data sources

| Platform | How |
|---|---|
| Codeforces | Official API: `problemset.problems`, `user.status`, `user.info`, `contest.list`, `contest.standings` |
| LeetCode | Unofficial GraphQL (rate-limited to 20 req / 10 s, cached) |
| AtCoder | kenkoooo AtCoder Problems API; upcoming contests read from atcoder.jp |
| CodeChef | Contest list endpoint; profile scraping for solves (best effort) |
| CSES | Bundled list (`data/seed/cses.json`). Import progress in Settings by pasting the problem-set page source |
| clist.by | All contests with your API key |

Sync runs automatically: problems and solves every 6 h, contests every hour, reminders every minute (1 h and 10 min before a contest).

## Code map

- `src/lib/engine/`: pure logic, unit-tested (`npm test`): `planner.ts`, `scheduler.ts`, `mastery.ts`, `rating.ts`
- `src/lib/server/`: database-backed services (`training.ts` is the core), `sync.ts`, `notify.ts`, `cron.ts`
- `src/lib/adapters/`: one adapter per platform
- `src/lib/concepts.ts`: the ~40-concept taxonomy and the tag → concept map (edit this to tune)
- `data/seed/neetcode250.csv`: the NeetCode 250 list (LeetCode links). You can replace it from Settings → Imports.

## Login

The app is behind a simple login. Credentials come from env vars only (see `.env.example`):
`AUTH_USER`, `AUTH_PASSWORD` (and optionally `AUTH_SECRET`). For local dev put them in `.env.local`.
If they aren't set, login is disabled.

## Deploy (Coolify)

1. New resource → this Git repo → Build Pack: **Dockerfile**, port **3000**.
2. Add a persistent storage volume mounted at **`/app/storage`** (database, uploads, cache live there).
3. Set the `AUTH_USER` and `AUTH_PASSWORD` environment variables (required to log in).
