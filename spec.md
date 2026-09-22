# Spec: Hash Growth Radar

The full technical plan, as built on 22 Sep 2026. A fresh session should be able to work from this file alone. The why behind it is in [intent.md](intent.md).

**Rules for whoever works on this repo**

- This is **Next.js 16**, which differs from older versions. Read the guide in `node_modules/next/dist/docs/` before writing Next.js code, as `AGENTS.md` says.
- Commit messages must **not** carry a co-author line.
- **Never push `docs/reddit-sources/`.** It is a local-only folder of copied Reddit pages.
- Do not claim a fact about an outside platform without its official page. Say when something was not verified.
- Before calling UI work done, test filter combinations and cross-page clicks in a real browser.

---

## 1. Stack

| Part | Choice |
|---|---|
| App | Next.js 16.3 (App Router), React 19.2, TypeScript, Tailwind CSS 4 |
| Icons, font | `lucide-react`, Inter through `next/font/google` |
| Database | Supabase Postgres, with `pg_cron` and `pg_net` for the schedule and the Vault for the secret |
| Hosting | Vercel, deployed from `main` |
| AI | Gemini `gemini-3.5-flash-lite` on the free tier by default. Up to 8 keys rotate. Anthropic is optional through `AI_PROVIDER=anthropic`. |
| Validation | Zod 4 |
| Tests | Vitest |
| Live URL | https://hash-growth-radar.vercel.app |

## 2. Architecture

```
Supabase Cron ──Bearer CRON_SECRET──▶ /api/cron/<job>   (answers "started", works in the background, 5 min max)

find videos:  sweep (month by month to 1 Jan 2026) · discover (newest since last look, relevance once a day)
              · channels (uploads playlists) · coverage (weekly check)           ──▶ videos, channels
read:         count check 50 videos per unit ──▶ read changed videos newest first up to the cursor ──▶ items
pipeline:     prefilter (free) ──▶ queue ──▶ AI form ──▶ guards ──▶ score ──▶ status "tagged"
hourly:       tag leftovers, rescore tagged items from the last 9 days
daily:        delete items 30 days after last_seen_at, unfollow quiet channels
pages:        Shortlist · YouTube (everyone + filters + recently dropped) · How it works
```

## 3. Source layout

```
src/app/shortlist/page.tsx            Shortlist page
src/app/read/page.tsx                 Read page: comments marked as read, newest first
src/app/platforms/[platform]/page.tsx YouTube page (NAV_PLATFORMS = ["youtube"])
src/app/how/page.tsx                  How it works and the system check
src/app/api/cron/*                    collect, sweep, discover, channels, coverage, process, cleanup, retag
src/app/actions.ts                    markRead() / markUnread(): the only things a page can change
src/app/api/nav-counts/route.ts       navbar badges as JSON, fetched after every page change
next.config.ts                        redirects / and /today to /shortlist (there is no page at /, see 8.1)
src/components/                       nav, nav-links, item-card, filter-bar, dropdown, sort-toggle, pagination, stat (PageHeader, Section), icons, toast (notice with Undo), score-help (the ? panel)
src/lib/config.ts                     every knob: PLATFORM_INFO, SHORTLIST, RETENTION_DAYS, YT, CONFIG (topics, keywords)
src/lib/queries.ts                    loadQueuePage, shortlistCount, tagFacets, statusCounts, recentDropped
src/lib/shortlist.ts                  shortlistFilter() (pure, tested)
src/lib/pipeline/                     prefilter, classify, guards, score, run (ingest, drain, rescore, cleanup)
src/lib/youtube/                      api, client, quota, rules, sweep, discover, channels, reader, coverage, watchlist
src/lib/ai/                           askJSON() with gemini or anthropic behind it; prompts; keyring
supabase/migrations/                  0001 schema, 0002 cron, 0003 watch list, 0004 facet counts
tests/                                vitest; 11 files, 96 tests
docs/                                 coverage-plan.html (the built design), youtube.html, knowledge-and-plan.md, reddit-access.html
```

## 4. Data model

The Supabase tables. Row-level security is on and no policies exist, so only the server's service-role key can read them.

| Table | One row per | Key columns |
|---|---|---|
| `items` | collected comment | `platform` = 'youtube', `external_id` (the comment ID, unique with platform), `url`, `community` ("YouTube · channel"), `body`, `posted_at`, `last_seen_at`, `video_id`, `status`, `filter_reason`, `score`, `meta` (video_title and similar) |
| `tags` | tagged item | `intent`, `conditions[]`, `medicines[]`, `competitor`, `fit_score` 0–100, `urgency`, `language`, `do_not_reply`, `do_not_reply_reason`, `summary`, `model` |
| `runs` | job run | job name, status, counts, error, notes |
| `jobs` | queued AI task | claimed atomically by `claim_jobs()` |
| `topics` | search phrase | search watermarks |
| `videos` | watched video | comment count, cursor fields, `next_check_at`, `status` (active, comments_disabled, gone, retired), `found_via` |
| `channels` | channel that made an on-topic video | uploads playlist, followed flag, history-walk position |
| `sweep_units` | phrase × month window | page token, status |
| `quota_ledger` | day, in Pacific time | searches and units spent |

**Item status:** `filtered` means dropped by the prefilter or tagged irrelevant. `queued` means waiting for the AI. `tagged` means it is on the list. `do_not_reply` means not suitable. `skipped` means someone pressed Mark as read (shown as "Read"; `meta.read_at` holds when). The old name is kept so existing rows stay valid. `posted` is a legacy value no longer used.

**Database functions:** `claim_jobs`, `item_status_counts`, `job_counts`, `upsert_videos`, `spend_quota`, and `tag_facets` from 0004. 0004 has been run on the live project: `tag_facets` answered from the live database on 22 Sep 2026. On a fresh project without 0004, `tagFacets()` falls back to counting in JavaScript, reading every row 1,000 at a time.

**No username or commenter ID column exists, anywhere.**

## 5. Schedule

Supabase Cron runs these. The limit is 8 jobs, each under 10 minutes, and 7 are used.

| Job | UTC schedule | Route | Work |
|---|---|---|---|
| radar_collect | every 2 h at :00 | `/api/cron/collect` | check counts, read changed videos, tag |
| radar_sweep | every 2 h at :10 | `/api/cron/sweep` | one-time month sweep; switches itself off when done |
| radar_discover | every 6 h at :20 | `/api/cron/discover` | newest since last look per phrase; relevance once a day |
| radar_channels | daily 08:30 | `/api/cron/channels` | uploads of followed channels and history walks |
| radar_process | hourly at :30 | `/api/cron/process` | leftover tagging and the rescore |
| radar_cleanup | daily 03:00 | `/api/cron/cleanup` | 30-day purge; unfollow quiet channels |
| radar_coverage | Mondays 09:00 | `/api/cron/coverage` | compare 20 channels' real uploads with the watch list |

Add `?wait=1` to run a route inline. The `retag` route exists for manual re-tagging.

## 6. YouTube rules

These values live in `YT` in `src/lib/config.ts`.

- **Budget.** The daily allowance is 100 searches and 10,000 units. Every call is written to `quota_ledger` before it is made. Jobs stop at 95 searches and 9,000 units. The sweep stops at 64 searches in a day, and the reader stops at 7,000 units.
- **Floors.** No comment is kept from before `2026-01-01`, and the sweep also walks back to that date.
- **Sweep.** It works month by month over two orders, view count and date. Each window allows 10 pages of 50. If a window is full, it is split, down to 24 hours.
- **Discover.** It reads up to 5 pages per phrase, newest first. It runs one relevance search per phrase every 20 hours. The first look goes back 30 days, with a 1-hour overlap.
- **Channels.** A followed channel's uploads are checked every 20 hours. A history walk reads at most 40 pages, and all walks together spend at most 2,000 units per run. A channel with no on-topic upload for 120 days is unfollowed.
- **Reader.** It checks the counts of 1,000 videos per run and reads at most 300 videos, 1,500 pages in total and 10 pages per video. A first read stops at 30 pages. Videos younger than 7 days are read on every run. Every video is read at least weekly. A video with no change for 60 days is checked weekly, and one with no change for 180 days is retired.
- **Search phrases:** diabetes diet · type 2 diabetes what to eat · PCOS diet plan · thyroid diet · hypothyroidism diet · Indian weight loss diet.

## 7. Pipeline

### 7.1 Prefilter

This is `src/lib/pipeline/prefilter.ts`. It is free and needs no AI. The checks run in this order, and the first one that fails gives the reason.

1. `too_short`: the text is under 15 characters.
2. `too_old`: the comment was posted before the floor date.
3. `blocked:<term>`: a block term is present, such as giveaway, promo code or crypto.
4. `no_keyword`: none of the allow terms is present. These are medicines, conditions, app names and diet phrases, matched as whole words.
5. `not_a_question`: no question hint is present, such as "?", "how ", "can i", "which " or "recommend".

It removes about 99 of every 100 comments.

### 7.2 AI form

The schema is `ClassificationSchema` in `src/lib/types.ts`, and the prompt is `CLASSIFY_SYSTEM` in `src/lib/ai/prompts.ts`.

- `intent` is one of `medicine_food_question`, `app_recommendation`, `nutrition_question`, `competitor_complaint` or `irrelevant`.
- The other fields are `conditions[]`, `medicines[]`, `competitor`, `fit_score` from 0 to 100, `urgency` (low, medium or high), `language` (en, hinglish or other), `do_not_reply`, `do_not_reply_reason` and a one-sentence `summary`.
- Output is validated with Zod. If it is invalid, the AI is asked once more with the error attached.
- Key rotation: a key that hits a rate limit is parked for 1 minute, or 1 hour if its daily quota is gone. If every key is parked, the job is deferred without using up an attempt.

### 7.3 Guards

These are in `src/lib/pipeline/guards.ts`. They apply when the AI calls a comment an app request or an app complaint but the text names no app, tracker or product. In that case:

- If a medicine or condition is named, it becomes `medicine_food_question`.
- Otherwise it becomes `nutrition_question`, with fit capped at 50.

### 7.4 Score

This is in `src/lib/pipeline/score.ts`.

```
score = fit + intent bonus + urgency bonus − age penalty

intent bonus:  medicine_food 15 · app_recommendation 10 · competitor_complaint 5 · nutrition 0
urgency bonus: low 0 · medium 3 · high 6
age penalty:   2 points per full day since posting, capped at 14
```

Every hour, the tagged items posted in the last 9 days are rescored (`RESCORE_WINDOW_DAYS`). If the age cap is ever raised, that window must be raised with it.

## 8. Pages and UI

### 8.1 Navbar

- A logo tile (no product name) is followed by Shortlist, YouTube, Read and How it works, each with an icon.
- Badges come from `navCounts()` in `src/lib/queries.ts`: the Shortlist count, everyone tagged per platform, and the Read count.
- **Badges must never be frozen.** The Nav calls `connection()`, so nothing that contains it is built ahead of time. Next.js keeps the layout across page changes, so the nav fetches `/api/nav-counts` after every page change and after every Mark as read or Move back. Bug fixed on 22 Sep 2026: `/` was a page prerendered at build time, and its frozen badges (133) stayed on screen next to a fresh Shortlist (143). `/` is now a redirect in `next.config.ts`.
- The highlight slides as soon as a tab is clicked. The remembered click is forgotten when the page changes, which fixed the "wrong tab highlighted" bug.
- **Three layouts.** Under 640 px: a top bar of four equal tabs, icon and badge above the label, no logo. 640 to 1023 px: a top bar with the logo and the tabs in a row. 1024 px and up: a fixed 240 px column on the left, with the content beside it.
- **On phones** the score shows as a small badge in the card's top line, so the comment gets the full width, and Copy link is an icon. The ? button is smaller, and the page keeps room under the last card so the button never covers one.
- **Checked on 22 Sep 2026** with headless Chrome at 320, 375, 414, 768, 1024, 1280, 1440 and 1920 px on every page. No sideways scrolling, every tab visible, dropdowns and the help panel on screen, all text at 11 px or more, text contrast at 4.5:1 or better, and no console errors.

### 8.2 Shortlist

- **Rules** live in `SHORTLIST` in `src/lib/config.ts`. The intent must be medicine_food, app_recommendation or competitor_complaint. The score must be 70 or more, and the comment must have been posted in the last 30 days.
- **Layout.** Pages of 25, with a Latest or Score sort and rule chips. There are no filters.
- **Size.** On 22 Sep 2026 it held 143 of the 2,769 tagged comments.

### 8.3 YouTube page

- **The list.** It shows every tagged item in pages of 25, sorted by score or by newest.
- **Collection panel.** A folded "How this list is collected" panel holds the details.
- **Filters.** There are three dropdowns: Group, Condition or medicine, and Minimum score (60, 70, 80 or 90). They are kept in the URL as `?group=`, `?term=` and `?min=`, and changing one resets the page to 1.
- **Counts.** Each dropdown's counts are computed under the **other two** filters, so a number always equals the rows that option gives. The Condition or medicine list shows the top 25 conditions and the top 25 medicines, and a chosen term stays listed even when it drops out of the top 25.
- **Dropdown component.** `src/components/dropdown.tsx` follows the listbox pattern, with icons, count badges and a check on the chosen option. The condition list has a search box. The keys are arrows, Enter, Space, Escape, Home, End and type-ahead, and a click outside closes it. Option clicks are handled once on the list, because React's ref lint rule rejects per-option handlers.
- **Recently dropped.** It shows the last 8 filtered or not-suitable items, with the reason in words (`dropReasonLabel()` in `src/lib/format.ts`) and no link.

### 8.4 Card

- **Score tile.** Solid green means 90 or more, light green means 70 or more, and grey means below 70.
- **Details.** The card shows the channel, the time posted and the video title, the comment text, and the AI summary.
- **Tags.** Only what the comment names: medicines in blue with a pill icon, conditions in purple with a heart icon, and the language in grey when it is not English. Colours are fixed by tag kind, never random. Each has a tooltip. The question type, urgency and competitor app are not shown on cards (removed 22 Sep 2026 as noise); the Group filter covers the type.
- **Buttons.** Open on YouTube (light green), Copy link, and Mark as read. On the Read page the last one is Move back. Both show a notice at the bottom with Undo.
- **Help.** A round ? button at the bottom right of every page opens a panel: the three score colours, the three tag colours with a note on where tags come from, and the score formula. Its numbers are imported from `src/lib/pipeline/score.ts`, so they cannot drift.

### 8.5 How it works

- Seven numbered sections cover the topics, how videos are found, the jobs, how comments are read, the drop rules, what the AI does and the score.
- A system check shows whether each key is present. Values are never shown.

### 8.6 Read

- Comments marked as read, most recently read first (ordered by `meta.read_at`), 25 a page, each with Move back and the time it was read.

Every page has its own browser-tab title, such as "Shortlist · Hash Growth Radar".

## 9. Environment

| Variable | Required | Use |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only database access |
| `CRON_SECRET` | yes | protects `/api/cron/*` |
| `YOUTUBE_API_KEY` | yes, for collection | YouTube Data API v3; restrict it to that API, with no app restriction |
| `GEMINI_API_KEY` or `GEMINI_API_KEY_1` … `_8` | yes, for tagging | rotated |
| `GEMINI_MODEL` | no | defaults to `gemini-3.5-flash-lite` |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | no | switch tagging to Claude; the default model is `claude-haiku-4-5` |

No key uses the `NEXT_PUBLIC_` prefix, so none reaches the browser. `.env.local` is git-ignored.

## 10. Edge cases already handled

- **Stale page number.** A `?page=` past the end falls back to page 1, and the page number is then clamped.
- **Failed read.** Cursors are saved only after comments are stored, so a failure never skips comments.
- **Creator's own comments.** They are dropped by comparing channel IDs in memory. The ID is then discarded.
- **Oversized search results.** A search window that hits YouTube's cap of about 500 results is split in two.
- **Comments disabled or video gone.** The video's status is changed and it stops being read.
- **Full AI quota.** When every Gemini key is parked, jobs are deferred instead of failing.
- **Supabase's 1,000-row cap.** Any query that needs more rows pages through them.
- **Missing counting function.** On a project where 0004 has not been run, the counts fall back to JavaScript.
- **Hidden tab.** A browser tab in the background freezes the entry animations. Screenshots taken then look faded, but that is not a bug.

## 11. Known gaps and next steps

1. The age penalty cap. Options were given; no decision yet.
2. A login gate through `requireUser()` in `src/lib/auth.ts`, using a signed cookie checked against an `APP_PASSWORD` variable.
3. Not built from the plan: push notifications, more search phrases, Hindi and Tamil keywords, a text hash for duplicate questions, a run lock, extra replies through `comments.list`, and a month filter.
4. A second source, only after an official door is confirmed. Threads needs App Review; X is paid.

## 12. How to verify a change

```bash
npm run typecheck && npm run lint && npm test && npm run build
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/collect?wait=1"
```

Then open `/shortlist`, `/platforms/youtube` and `/how` in a browser.

- Combine the filters, and check that each dropdown count equals the number of rows shown.
- Check that the nav highlight follows both nav clicks and links inside the page.
- Check that no page scrolls sideways at a width of 380 px.
- Check that the console shows no errors on a clean load.
