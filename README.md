# Hash Growth Radar

Internal tool for the Hash Health team. It finds people online who are asking the questions Hash answers (food with a medicine or condition, "which calorie app understands Indian food"), tags and ranks them, and shows you the best ones each day. You open the thread and approach the person yourself. The tool never writes, suggests, or posts a reply.

- What it is and why, in plain language: [docs/PRODUCT.md](docs/PRODUCT.md)
- Full explanation per platform, how data is collected legally, and what happens to it: [docs/overview.html](docs/overview.html) (open in a browser)
- What happens in the background, call by call: [docs/behind-the-scenes.html](docs/behind-the-scenes.html)
- Build checklist: [TODO.md](TODO.md)

## How it works

```
collect  →  store (dedupe)  →  keyword filter  →  AI tags the question  →  rank  →  you look and decide
```

| Platform | How items get in | Notes |
|---|---|---|
| YouTube | Automatic (`YOUTUBE_API_KEY`) | Free allowance 100 searches/day + 10,000 units/day. Defaults use 48 searches (4 per run, topics rotate) and a few hundred units |
| Reddit | Paste by hand | Reddit requires API approval since June 2026 (see "Reddit access" below). The automatic collector is included and switches on once approved |

Hacker News, App Store, Play Store and Product Hunt were removed on 16 Sep 2026 by decision (too few reachable people, or no legal automatic door).

Each platform has its own page in the navbar: status counts, last run, configuration check, run-now or paste form, its list of people, what was dropped and why, and the run history.

**Privacy rule (enforced in code):** the tool tags the question, never the person. No username field exists anywhere. Items are deleted 7 days after collection.

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
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (later) | Only after Reddit approves your access request |

Free-tier note: Google may use free-tier Gemini prompts to improve its products. The prompts contain public post text only, never usernames. Move to a paid Gemini tier or to Claude if that matters to you.

**Gemini key rotation.** Set `GEMINI_API_KEY_1` … `GEMINI_API_KEY_8` (plus or instead of `GEMINI_API_KEY`) and every AI call takes the next key in turn. When a key returns a rate limit it is parked for a minute, or an hour if the message says the daily quota is gone, and the next key is tried straight away. The Settings page shows how many keys are in the rotation. Only when every key is parked does the job fail, and the queue retries it later with its own backoff.

**API key security.** `YOUTUBE_API_KEY` and the Gemini keys are read on the server only and never reach the browser (no `NEXT_PUBLIC_` prefix, so Next.js cannot inline them). In Google Cloud, restrict the YouTube key under "API restrictions" to YouTube Data API v3, and leave "Application restrictions" as **None**: website and IP restrictions are for calls made from a browser or a fixed server address, and the host's outbound addresses are not fixed, so either would break collection.

### 2. Database

In Supabase → SQL Editor, paste and run:

1. `supabase/migrations/0001_schema.sql`: every table, index, function and the row-level-security lock. Safe to run again on an existing project; it changes nothing that already exists.
2. `supabase/migrations/0002_cron.sql`, only after the app is deployed (step 4 below). Replace the two placeholders at the top first.

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, then:

- Settings: check that every required key shows "set" and the AI provider shows "ready".
- YouTube page → the list fills up as the schedule runs. To trigger one run by hand (locally or on the deployed app), call the cron route with your secret:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/collect?wait=1"
  ```

- Reddit page → paste a post link and text.
- Today page → the top 10 across platforms. Open a thread, approach the person yourself, then press "Approached" or "Skip".

Locally there is no schedule (Supabase Cron cannot reach your laptop), but `npm run dev` reads the same Supabase database the deployed app writes to, so everything the cron collected is already there. Use the curl above only if you want an extra run right now.

### 4. Deploy and schedule

1. Push to GitHub and import the repo in Vercel (any Node host works; the app is plain Next.js).
2. Add every variable from `.env.local` under Project → Settings → Environment Variables (Production). Deploy.
3. In Supabase → Integrations, enable **Cron** and **pg_net** (or just run the SQL, it enables both).
4. Open `supabase/migrations/0002_cron.sql` (the app URL is already filled in), replace `<CRON_SECRET>` with the same value you set in step 2, paste it into the SQL Editor and run it. Safe to run again later with a new URL or secret. Keep the filled-in copy out of git: any file named `*.local.sql` is ignored.

That registers three jobs inside your database. Checked against supabase.com/docs/guides/cron on 16 Sep 2026: any schedule from every second to once a year, at most 8 jobs at once, each under 10 minutes.

| Job | Schedule | Route |
|---|---|---|
| Collect YouTube + tag | every 2 hours | `/api/cron/collect` |
| Finish leftover tagging | every hour at :30 | `/api/cron/process` |
| Delete items older than 7 days | daily 03:00 UTC (08:30 IST) | `/api/cron/cleanup` |

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

### Reddit access

Two separate steps, both done once by you, then a wait. Registering alone gives you codes but **no data**.

| Step | Where | What you get | When |
|---|---|---|---|
| A. Register the app | `reddit.com/prefs/apps` → "create another app", type "script", redirect URL `http://localhost:8080` | Two codes (client id, secret). They return **no data** until step B is approved | Instant |
| B. Ask for permission | `support.reddithelp.com/hc/en-us/requests/new` → developer / data access category, describe the tool honestly | Reddit's decision by email | Weeks (developers report 2 to 4, sometimes no reply) |

Only after a yes: put the two codes in `.env.local` as `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`, tick "Reddit API enabled" in Settings, and the Reddit collector runs on its own. Until then, and if the answer is no, the Reddit page's paste form is how Reddit posts get in. It works today and needs no approval.

### Login

There is no login yet, by decision. The dashboard is open to anyone who has the URL, so keep the deployed URL private: anyone who finds it can read the list and paste posts, which spends your Gemini allowance. When you want a password gate, implement it in `src/lib/auth.ts` (every page and action already calls `requireUser()`), for example a signed cookie checked against an `APP_PASSWORD` env var. The cron routes are already protected by `CRON_SECRET`.

## Scripts

```bash
npm run dev        # local server
npm test           # unit tests (prefilter, scoring, ids, AI schema, key rotation)
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

## Project layout

```
src/app/today                 top 10 across platforms
src/app/platforms/[platform]  one page per platform: status, collect / paste, list, dropped, runs
src/app/settings              env presence, AI health, watch lists, keyword filter
src/app/api/cron/*            collect, process, cleanup (CRON_SECRET protected, called by Supabase Cron)
src/app/actions.ts            server actions (approached, skip, run now, paste, settings)
src/lib/collectors/           youtube, reddit (optional), manual paste
src/lib/pipeline/             prefilter, classify, score, run
src/lib/ai/                   askJSON() with Gemini (default) or Anthropic behind one interface
src/lib/queue.ts              small Postgres-backed job queue
supabase/migrations/          0001 schema (tables, functions, RLS), 0002 cron schedule
tests/                        vitest unit tests
```

## Rules the code enforces

- The tool never writes, suggests, or posts a reply. Pressing "Approached" only removes the card; what you said is never stored.
- Items the AI flags as dosage, diagnosis, emergency, eating disorder or mental health are marked "not suitable" and never enter the list.
- No username is stored anywhere. Items are deleted after 7 days.
