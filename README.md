# Hash Growth Radar

Internal tool for the Hash Health team. It keeps a watch list of every YouTube video it can reach about diabetes, PCOS and thyroid diets, reads every new comment under those videos, keeps the ones where someone is asking the question Hash answers (food with a medicine or condition), tags and ranks them, and shows you the best ones. You open the comment and approach the person yourself. The tool never writes, suggests, or posts a reply.

- How every video under a topic is found and every new comment is read, the jobs, the budget, the failure cases: [docs/coverage-plan.html](docs/coverage-plan.html) (open in a browser). **This is the design that is built.**
- What Hash is, the competitors and the YouTube facts behind that design: [docs/knowledge-and-plan.md](docs/knowledge-and-plan.md)
- The API calls, the AI form and the keyword filter in detail: [docs/youtube.html](docs/youtube.html) (its sections on searching and topic rotation describe the version before 17 Sep 2026)

## How it works

```
find videos (sweep · newest-since · relevance · channel uploads)  →  watch list
watch list  →  count check  →  read changed videos to the last comment seen  →  store (dedupe)  →  keyword filter  →  AI tags the question  →  rank  →  you look and decide
```

YouTube is the only source (Reddit, Hacker News, the app stores and Product Hunt were considered and removed on 16 Sep 2026: approval needed, too few reachable people, or no legal automatic door). Google's free allowance is two separate pots, 100 searches a day and 10,000 units a day; every call is counted in a ledger before it is made and the jobs stop at 95 and 9,000.

Three pages: **Today** (the top 10), **YouTube** (every person found, 25 a page, with filters by group, condition or medicine, and minimum score; plus what was dropped and why) and **How it works** (the topics, how comments are collected, how they are classified, how the score is computed, a system check). There is no Settings page; topics and keyword lists live in `src/lib/config.ts`.

**Privacy rule (enforced in code):** the tool tags the question, never the person. No username field exists anywhere; the commenter's channel id is compared in memory with the video's channel (to drop the creator's own comments) and then discarded. Stored comments are deleted 30 days after YouTube last returned them (YouTube's Developer Policy III.E.4.d).

## Setup

### 1. Accounts and keys

Copy `.env.example` to `.env.local` and fill in:

| Key | Where to get it |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → project → Settings → API |
| `CRON_SECRET` | Any random string of 16+ characters |
| `GEMINI_API_KEY` | aistudio.google.com/apikey (free tier). Several keys? Use `GEMINI_API_KEY_1` … `_8` instead and the app rotates them |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` (the older 2.5 flash-lite is closed to new users and returns 404) |
| `YOUTUBE_API_KEY` | console.cloud.google.com → APIs & Services → Library → enable "YouTube Data API v3" → Credentials → Create credentials → API key |
| `ANTHROPIC_API_KEY` (optional) | console.anthropic.com, then set `AI_PROVIDER=anthropic` |

Free-tier note: Google may use free-tier Gemini prompts to improve its products. The prompts contain public post text only, never usernames. Move to a paid Gemini tier or to Claude if that matters to you.

**Gemini key rotation.** Set `GEMINI_API_KEY_1` … `GEMINI_API_KEY_8` (plus or instead of `GEMINI_API_KEY`) and every AI call takes the next key in turn. When a key returns a rate limit it is parked for a minute, or an hour if the message says the daily quota is gone, and the next key is tried straight away. The "How it works" page shows how many keys are in the rotation. Only when every key is parked does the job fail, and the queue retries it later with its own backoff.

**API key security.** `YOUTUBE_API_KEY` and the Gemini keys are read on the server only and never reach the browser (no `NEXT_PUBLIC_` prefix, so Next.js cannot inline them). In Google Cloud, restrict the YouTube key under "API restrictions" to YouTube Data API v3, and leave "Application restrictions" as **None**: website and IP restrictions are for calls made from a browser or a fixed server address, and the host's outbound addresses are not fixed, so either would break collection.

### 2. Database

In Supabase → SQL Editor, paste and run:

1. `supabase/migrations/0001_schema.sql`: every table, index, function and the row-level-security lock. Safe to run again on an existing project; it changes nothing that already exists.
2. `supabase/migrations/0003_watchlist.sql`: the watch list (topics, videos, channels, sweep_units, quota_ledger, the `upsert_videos` and `spend_quota` functions, the new `items` columns). Safe to run again.
3. `supabase/migrations/0002_cron.sql`, only after the app is deployed (step 4 below). Replace the two placeholders at the top first.

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, then:

- How it works → System check: every required key shows ✓ and the AI provider shows "ready".
- YouTube page → the list fills up as the schedule runs. To trigger one run by hand (locally or on the deployed app), call the cron route with your secret:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/sweep?wait=1"      # fill the watch list (month sweep)
  curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/channels?wait=1"   # follow the channels
  curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/collect?wait=1"    # read comments + tag
  curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/retag"             # one-off: re-check app-request tags (see below)
  ```

- Today page → the top 10. Open a comment, approach the person yourself if you want to, then press "Skip" to clear the card.

Locally there is no schedule (Supabase Cron cannot reach your laptop), but `npm run dev` reads the same Supabase database the deployed app writes to, so everything the cron collected is already there. Use the curl above only if you want an extra run right now.

### 4. Deploy and schedule

1. Push to GitHub and import the repo in Vercel (any Node host works; the app is plain Next.js).
2. Add every variable from `.env.local` under Project → Settings → Environment Variables (Production). Deploy.
3. In Supabase → Integrations, enable **Cron** and **pg_net** (or just run the SQL, it enables both).
4. Open `supabase/migrations/0002_cron.sql` (the app URL is already filled in), replace `<CRON_SECRET>` with the same value you set in step 2, paste it into the SQL Editor and run it. Safe to run again later with a new URL or secret. Keep the filled-in copy out of git: any file named `*.local.sql` is ignored.

That registers seven jobs inside your database (docs/coverage-plan.html section 6). Checked against supabase.com/docs/guides/cron on 16 Sep 2026: any schedule from every second to once a year, at most 8 jobs at once, each under 10 minutes.

| Job | Schedule (UTC) | Route | Does |
|---|---|---|---|
| radar_collect | every 2 hours at :00 | `/api/cron/collect` | Job 6: check comment counts, read the videos that changed, tag |
| radar_sweep | every 2 hours at :10 | `/api/cron/sweep` | Job 1: the one-time month sweep of every phrase, newest month first; switches itself off when done |
| radar_discover | every 6 hours at :20 | `/api/cron/discover` | Jobs 2 + 3: "newest since last look" per phrase, one relevance search a day |
| radar_channels | daily 08:30 (just after the quota reset) | `/api/cron/channels` | Job 4: uploads playlists, the newest page of every followed channel, then history walks that resume where they stopped |
| radar_process | every hour at :30 | `/api/cron/process` | Leftover AI tagging |
| radar_cleanup | daily 03:00 | `/api/cron/cleanup` | Job 7: 30-day purge, unfollow quiet channels |
| radar_coverage | Mondays 09:00 | `/api/cron/coverage` | Job 8: compare 20 followed channels' real upload lists with the watch list |

The database calls each route with `Authorization: Bearer <CRON_SECRET>` and waits only 10 seconds, so collect and process answer "started" at once and do the work in the background (they still get the full 5 minutes). Add `?wait=1` to run inline and see the result, for example by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>.vercel.app/api/cron/collect?wait=1"
```

Check the schedule or the last runs in the SQL Editor:

```sql
select jobname, schedule, active from cron.job;
select jobname, status, start_time, return_message from cron.job_run_details order by start_time desc limit 20;
```

Free Supabase projects pause after a week with no API activity. Each cron call makes the app read and write the database, so a working schedule keeps the project awake on its own.

### Login

There is no login yet, by decision. The dashboard is open to anyone who has the URL, so keep the deployed URL private: anyone who finds it can read the list and press "Skip". When you want a password gate, implement it in `src/lib/auth.ts` (every page and action already calls `requireUser()`), for example a signed cookie checked against an `APP_PASSWORD` env var. The cron routes are already protected by `CRON_SECRET`.

## Scripts

```bash
npm run dev        # local server
npm test           # unit tests (prefilter, scoring, AI schema, key rotation, cron auth)
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

## Project layout

```
src/app/today                 top 10 across platforms
src/app/platforms/[platform]  one page per platform: status, collect / paste, list, dropped, runs
src/app/how                   the topics, how comments are collected, how they are classified, system check
src/app/api/cron/*            collect, sweep, discover, channels, coverage, process, cleanup (CRON_SECRET protected, called by Supabase Cron)
src/app/actions.ts            server action (skip)
src/lib/youtube/              api (the five calls + ledger), quota, rules (pure decisions), sweep, discover, channels, reader, coverage, watchlist (tables)
src/lib/collectors/           youtube (= the reader)
src/lib/pipeline/             prefilter, classify, score, run
src/lib/ai/                   askJSON() with Gemini (default) or Anthropic behind one interface
src/lib/queue.ts              small Postgres-backed job queue
supabase/migrations/          0001 schema, 0002 cron schedule, 0003 watch list
tests/                        vitest unit tests
```

## Rules the code enforces

- The tool never writes, suggests, or posts a reply. "Skip" only hides the card; what you did is never stored.
- Items the AI flags as dosage, diagnosis, emergency, eating disorder or mental health are marked "not suitable" and never enter the list.
- No username is stored anywhere. Stored comments are deleted 30 days after YouTube last returned them.
- Every YouTube call is counted in `quota_ledger` before it is made; the jobs stop at 95 of the 100 daily searches and 9,000 of the 10,000 daily units.
