# Hash Growth Radar — build TODO (Claude's working list)

Scope (changed 16 Sep 2026 by the founder, YouTube only since the same evening): the tool only FINDS the audience. Collect → dedupe/freshness → keyword filter → AI tagging → rank → show. No reply drafting, no reply suggestions, no posting tracking. Runs by itself on Supabase Cron once deployed. Human opens the thread and approaches the person their own way. No usernames stored, comments deleted 30 days after YouTube last returned them.

## 0. Foundations
- [x] Node 24.18, npm 11.5, git 2.47
- [x] Next.js 16.3 (App Router, TypeScript, Tailwind 4, src/)
- [x] Docs: docs/knowledge-and-plan.md (17 Sep 2026), docs/youtube.html (rewritten from the code 21 Sep 2026), README.md
- [x] Deps: @supabase/supabase-js 2.116, @google/genai 2.22, @anthropic-ai/sdk 0.126, zod 4.6, vitest 3
- [x] `.env.example` with every key and where to get it

## 1. Database
- [x] 0001_schema.sql (squashed 16 Sep 2026 from seven incremental files; live DB already matches): `items` (no author column), `tags`, `runs`, `jobs` + `claim_jobs()`, `item_status_counts()`, `job_counts()`, value checks matching types.ts, RLS on (the old `settings` table is dropped)
- [x] 0003_watchlist.sql: topics, videos, channels, sweep_units, quota_ledger, `upsert_videos()`, `spend_quota()`
- [x] 0002_cron.sql: pg_cron + pg_net, secrets in Vault (upsert, safe to re-run), seven schedules (collect 2-hourly, sweep 2-hourly, discover 6-hourly, channels daily, process hourly at :30, cleanup daily, coverage weekly)
- [x] Retention: cleanup deletes comments 30 days after `last_seen_at`

## 2. Core libraries
- [x] `db.ts`, `env.ts`, `config.ts` (topics + keyword lists; no Settings page, no settings table)
- [x] `ai/` askJSON() — Gemini (responseJsonSchema) + Anthropic (output_config json_schema); zod-validated, one retry
- [x] `ai/keyring.ts` — rotate GEMINI_API_KEY_1..8, park a key on 429
- [x] Gemini model `gemini-3.5-flash-lite` (2.5 flash-lite returns 404 for new users)
- [x] `pipeline/prefilter.ts`, `guards.ts`, `score.ts`, `classify.ts`, `run.ts`
- [x] `youtube/` sweep, discover, channels, reader, coverage (the watch list, 17 Sep 2026); `collectors/youtube.ts` is the reader. Reddit collector and manual paste removed 16 Sep 2026
- [x] `queue.ts` enqueueMany / claim / complete / fail with backoff / defer (all AI keys parked: no attempt spent, drain stops) / stale release; orphan requeue also clears exhausted failed jobs

## 3. Routes / actions
- [x] `api/cron/collect`, `sweep`, `discover`, `channels`, `coverage`, `process` answer 202 and work in the background via `after()` (Supabase's HTTP call waits ~10 s); `?wait=1` runs inline. `cleanup` and `retag` inline. All gated by CRON_SECRET
- [x] Server action: skip only (Approached removed 16 Sep 2026; the cron is the only collector)
- [x] No login for now (user's decision); `requireUser()` stub in `src/lib/auth.ts`

## 4. UI
- [x] Navbar: Shortlist · YouTube · How it works, with badges
- [x] `/shortlist`: score 70+, posted in the last 30 days, no general nutrition questions (replaced the `/today` top 10 on 21 Sep 2026; `/today` redirects)
- [x] `/platforms/youtube` people list (filters, 25 a page), dropped-with-reason
- [x] `/how` topics, how comments are collected, how they are classified, how fit and score work, system check (read-only)
- [x] Card: platform, community, time, post, video title, tags, summary, score (fit is folded into it); buttons Open thread / Copy link / Skip. No draft, no reply text

## 5. Quality
- [x] vitest: prefilter, guards, scoring, AI schema, key rotation, cron auth, YouTube api / quota / reader / sweep (92 tests)
- [x] `tsc --noEmit`, `eslint`, `next build` pass
- [x] First real run (16 Sep 2026): YouTube collected, items tagged
- [x] User ran every schema migration (live DB = 0001_schema.sql)
- [ ] After deploy: run 0002_cron.sql with the real URL + secret, then check `cron.job_run_details` after two hours

## 6. Removed on 16 Sep 2026 (by decision)
- Reply drafting, draft safety checks, 1-in-10 mention rule, fact sheet, "mark posted" with text, replies table, Vercel cron (`vercel.json`)
- Hacker News collector, App Store / Play Store review paste, Product Hunt paste, then Reddit (collector + paste form), the Settings page and the settings table (only YouTube remains)

## 7. Later (not now)
- Password gate. Reddit again only if Reddit ever approves API access
