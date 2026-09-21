# Knowledge and plan

Part 1 is everything we know for certain, with where each fact came from and when it was checked. Part 2 is the plan built on those facts: how the radar will cover every video on Hash's topics, every new upload, every new comment, and the year back to 1 January 2026. Written 17 September 2026.

**Status, later on 17 September 2026:** the core of Part 2 is built for the 6 phrases, as described in `docs/coverage-plan.html`: the `videos`, `channels`, `topics`, `sweep_units` and `quota_ledger` tables, the month sweep (newest month first, two orders, page position saved after every page), newest-since and relevance searches, channel following through upload playlists, change-detection comment reading with a cursor, the 30-day purge, and the weekly coverage check. Not built: push notifications, the expanded phrase list (section 5), the Tamil and Hindi keyword work (section 11), the text hash for duplicate questions, a run lock, fetching extra replies with `comments.list`, reads scheduled at fixed times after an upload, a month filter on the YouTube page, and a pillar column on topics. Where Part 2 differs from `docs/coverage-plan.html`, the coverage plan is what was built.

**Part 1 · Knowledge**
1. [Hash Health, as the website describes it](#1--hash-health-as-the-website-describes-it)
2. [Competitors, grouped by what they compete on](#2--competitors-grouped-by-what-they-compete-on)
3. [YouTube facts the plan depends on](#3--youtube-facts-the-plan-depends-on)
4. [What the radar does today, and the two gaps](#4--what-the-radar-does-today-and-the-two-gaps)

**Part 2 · The plan**
5. [Topic map](#5--topic-map-one-phrase-list-per-pillar-of-the-site)
6. [Three layers of coverage](#6--three-layers-of-coverage-the-answer-to-cover-every-video)
7. [Reading comments](#7--reading-comments-change-detection-instead-of-age-rules)
8. [Storage and rules](#8--storage-and-the-rules-we-keep)
9. [Schedule and budget](#9--schedule-and-the-daily-budget)
10. [Edge cases](#10--edge-cases-and-how-each-is-handled)
11. [Decisions taken](#11--decisions-taken-on-17-september-2026)
12. [Build order](#12--build-order-when-approved)
13. [Not decided yet](#13--not-decided-yet)

---

# Part 1 · Knowledge

Facts only. Each section names its source and the date it was read.

## 1 · Hash Health, as the website describes it

Hash Health is a wellness app: you photograph your plate, it logs the meal in seconds, shows the whole day on one card, checks every meal against your medicines, and answers questions about your food and health ("Ask Hash"). It also has barcode scanning, saved meals and symptom tracking. A second product, **Hash Coach**, is a platform for nutritionists: clients log meals by photo, the system drafts guidance, the nutritionist reviews it before it is sent.

**The four headlines on the site**

- "Snap the plate. Logged in seconds."
- "Your whole day, on one card."
- "Every meal, checked against your meds."
- "Ask anything about your food and health."

**Conditions the site names:** Type 2 diabetes · Hypertension · Anemia · Hypothyroidism · PCOS · Osteoporosis · Heart health

**Medicines and medicine groups the site names:** Warfarin · Statins · Levothyroxine · Doxycycline · MAOIs · Thyroid medicines · Blood pressure medicines · Metformin · Ciprofloxacin · Lithium · Ibuprofen

**Foods in the site's interaction examples:** Grapefruit · Filter coffee · Coffee · Cabbage · Milk · Aged cheese · Bran · Banana · Alcohol · Spinach · Curd · Cranberry juice · Soy

**Who it is for, in the site's words:** Medication users · Wellness goals · Chronic conditions · Busy lives. Nutritionists are served by Hash Coach (hashhealth.io/providers).

The meal examples are Indian: chicken biryani and roti, dal and sabzi on the home page; chapathi with paneer bhurji and a thali on /providers. The medical disclaimer says the app is not a medical device, gives general wellness information only, must not be used in an emergency, and that users must not change medicines without a doctor. The radar's "not suitable" rule (dosage, diagnosis, emergency) follows the same line.

*Source: hashhealth.io, hashhealth.io/providers, hashhealth.io/medical-disclaimer, read 17 Sep 2026.*

## 2 · Competitors, grouped by what they compete on

The same person can be a Hash user or a user of any app below. Their names matter to the radar in two ways: as YouTube channels worth following, and as the place where "which app should I use" questions are asked.

| Group | Apps and tools | Why it matters to the radar |
|---|---|---|
| Medicine + food checkers (closest to Hash's unique feature) | saviMon (meal photo + medicine, supplement and allergen interactions), MediFoodCheck (scan meal, label or barcode, green/yellow/red against your medicines), MediMeal Safe, Pillo Safety Checker (medication reminder with drug-food checks). Web only: DrugBank food interaction checker, WebMD, Drugs.com, Medscape. Samsung Health has shown food warnings in its medication tracker since 2023 (US data from Elsevier). | Small, new, mostly US-facing. Our guess (unverified): their review videos are rare, so their names as search phrases would return little today, but they should be watched. |
| Calorie and photo logging, global | MyFitnessPal, Cal AI, Lose It!, Yazio, MyNetDiary, Fooducate, Nutrola. | Big comment sections under review videos. Complaints about Indian food and about medicines being ignored are Hash's opening. |
| Calorie and photo logging, India | HealthifyMe (widely used in India, human coaches, Indian food database), FitTrack AI, CalFix (Hindi and Bengali interface), NutriScan, FitGenZ, Fitelo. | Same audience as Hash. Their channels and the "best calorie app India" review videos are the richest source of app-recommendation questions. |
| Condition programs, India | Fitterfly (diabetes, PCOS, thyroid programs; 100+ videos inside its paid programs, plus a YouTube channel, Fitterfly Wellness & DTx), BeatO (diabetes, glucometer, GLP-1 support), sugar.fit (diabetes reversal). | Their viewers are exactly the "chronic condition" audience. Our guess (unverified): company channels may moderate comments, so expect questions rather than complaints. |
| GLP-1 (Ozempic, Mounjaro) meal apps | Dose AI and others. | Not on Hash's site. Our impression (unverified, not measured) is that "what to eat on Ozempic" is one of the biggest medicine-and-food questions on YouTube in 2026. Worth a topic. |

*Sources: web search 17 Sep 2026 (Google Play listings for saviMon and MediMeal Safe; medifoodcheck.com; pillo.care; fittrackai.in, calfix.app, nutriscan.app, nutrola.app, fitgenz.live comparison posts; fitterfly.com, beatoapp.com; cbinsights.com BeatO vs sugar.fit). Comparison posts written by competitors were used only for the list of names, not for any claim about quality or price.*

## 3 · YouTube facts the plan depends on

`docs/youtube.html` documents the calls the radar makes (rewritten 21 Sep 2026 for the watch-list design). These are the extra facts, checked on 17 Sep 2026, that make the new plan possible.

| Fact | Detail | Source |
|---|---|---|
| Search is not a complete index | A search query stops paging at roughly 500 results, whatever the true number of matching videos. Results are ranked for relevance, not completeness, and the same query returns a different set on different days. The only way past the 500 cap is to split the query into date windows with `publishedAfter` and `publishedBefore`. | Google's search.list page states a 500-video cap only for searches inside one channel (`channelId` with `type=video`); for keyword searches the ~500 cap is community-reported (youtube/api-samples issue 500, truelogic.org, outlierkit.com; not re-checked). arXiv 2506.04422 documents the drift. |
| Search costs | 1 search from the 100-a-day bucket per page, whatever `maxResults` (0 to 50). Extra filters available: `channelId`, `order=date`, `videoDuration` (short = under 4 minutes), `regionCode`, `relevanceLanguage`, `eventType`. The code uses `order`, `publishedAfter`/`publishedBefore` and `relevanceLanguage`. | developers.google.com/youtube/v3/docs/search/list |
| A channel's uploads are cheap to list | `playlistItems.list` on the channel's uploads playlist: 1 unit per page of up to 50 videos. Does not touch the search bucket. The uploads playlist id comes from `channels.list` (1 unit, a comma-separated list of channel ids; the code sends up to 50). | …/docs/playlistItems/list, …/docs/channels/list |
| Video statistics are cheap | `videos.list`: 1 unit per call, a comma-separated list of video ids (Google gives no limit; the code sends up to 50), returns view count and comment count. Google says `maxResults` is not supported together with `id`. | …/docs/videos/list |
| New uploads can be pushed to us for free | Google's WebSub hub sends an HTTP notification to a public URL of ours whenever a channel uploads a video or changes a title or description. Topic: `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`. Google's page does not mention a quota cost. A subscription lasts at most 10 days and must be renewed. | …/guides/push_notifications (mechanism); the 10-day lease is from the PubSubHubbub community, not Google's page |
| Replies | `commentThreads.list` with `part=replies` returns, in Google's words, "a limited number of replies" per thread at no extra cost (developers report up to 5); `comments.list?parentId=` (1 unit) returns the rest. A reply's id from the API already has the form `PARENT.REPLY` (checked live), and `watch?v=VIDEO&lc=PARENT.REPLY` is the link form YouTube's own site uses; it is not in Google's docs. | …/docs/commentThreads, …/docs/comments/list |
| Errors we will meet | `commentsDisabled` (403) when a video has comments off; `videoNotFound` (404) when a video is gone or private; `quotaExceeded` (403) when the day's allowance is used. Invalid requests still cost at least 1. | …/docs/commentThreads/list, the API's core errors page, …/getting-started ("invalid requests incur at least a one-point quota cost") |
| The quota day | Resets at midnight Pacific time: 12:30 PM in India during US summer time, 1:30 PM during US winter time. | …/determine_quota_cost |
| How long we may keep data | Developer Policies III.E.4.d: data fetched without a user's login ("Non-Authorized Data") may be stored temporarily, in limited amounts, for no longer than 30 calendar days, then must be deleted or refreshed. | developers.google.com/youtube/terms/developer-policies |
| More quota | Through the "YouTube API Services - Audit and Quota Extension Form", after a compliance audit. Developer Policies III.D.1.c allow exactly one API project per API client, so multiplying projects to get more quota is not allowed. | …/guides/quota_and_compliance_audits, …/terms/developer-policies |

## 4 · What the radar did until 17 September 2026, and the two gaps

Until 17 September 2026, every 2 hours: search 4 of the phrases, take the top 5 videos by relevance from the last 90 days, read the newest 50 comments of each, drop repeats, keyword-filter, send the rest to the AI, score, show the top 10. Items were deleted after 7 days. Both gaps below are what the watch list (`docs/coverage-plan.html`) was built to close.

**The 6 phrases:** diabetes diet · type 2 diabetes what to eat · PCOS diet plan · thyroid diet · hypothyroidism diet · Indian weight loss diet. (Three calorie-app phrases, "calorie tracking app review", "Cal AI review" and "HealthifyMe review", were removed on 17 September 2026 by the founder's decision.)

> **Gap 1: the wrong width.** Only the 5 most relevant videos per phrase are ever read, and only if they are under 90 days old. A new upload that never reaches the top 5 is never seen. A 2022 "metformin diet" video that still gets questions every week is never seen. And while 5 of the 6 phrases name a condition on Hash's site (diabetes, PCOS, thyroid), none names a medicine: hypertension, anemia, osteoporosis, heart health, warfarin, statins, levothyroxine and metformin are not searched at all.

> **Gap 2: no history.** Collection started on 16 Sep 2026. People have been asking these questions all year.

*Source: `src/lib/config.ts` and `src/lib/collectors/youtube.ts` as they were on 17 Sep 2026, before the watch list.*

---

# Part 2 · The plan

> **Read this first.** Part 2 is the proposal as written on 17 September 2026. Its core was built the same day, with different numbers in places (schedules, caps, how the sweep pages). Where Part 2 differs from `docs/coverage-plan.html`, the coverage plan describes what exists in code.

Built on Part 1. Everything fits the free allowance (100 searches and 10,000 units a day), by the founder's decision.

## 5 · Topic map: one phrase list per pillar of the site

Topics move from a code constant to a `topics` table (phrase, pillar, language, active, last searched, backfill position). Around 90 phrases in total, including Tamil and Hindi forms. (Planned. Built: topics are seeded from `src/lib/config.ts`; there is no pillar column, and the sweep position lives in `sweep_units`.) Examples per pillar:

| Pillar | Example phrases |
|---|---|
| Medicine + food (Hash's unique feature) | metformin diet · what to eat on metformin · warfarin foods to avoid · levothyroxine what not to eat · thyroid medicine food · statins grapefruit · blood pressure medicine foods to avoid · doxycycline milk · ciprofloxacin food · lithium diet · MAOI diet · Ozempic diet · Mounjaro what to eat |
| Conditions | type 2 diabetes diet · diabetes diet Indian · prediabetes diet · hypertension diet · anemia iron rich diet · hypothyroidism diet · thyroid diet · PCOS diet plan · osteoporosis diet · cholesterol diet · heart healthy Indian diet |
| Calorie and photo apps (proposed only; the founder removed the three app phrases from the live list on 17 Sep 2026, so this pillar needs an explicit yes) | best calorie counter app India · photo calorie counter app · MyFitnessPal Indian food · Lose It review · Yazio review · FitTrack AI · CalFix · NutriScan · Nutrola · FitGenZ |
| Condition programs, India | Fitterfly review · BeatO review · sugar.fit review · Fitelo review |
| Medicine-food checkers | saviMon app · MediFoodCheck · Pillo app |
| Tamil, Tanglish | sugar patient diet in tamil · thyroid diet tamil · PCOS diet tamil · thyroid ku enna sapdalam · sugar ku enna sapdalam · Tamil-script forms of the same |
| Hindi, Hinglish | sugar ki diet · thyroid me kya khaye · PCOS diet in hindi · BP ki dawai ke saath kya khaye · Devanagari forms of the same |

Each phrase carries its language, and the search's `relevanceLanguage` is set per phrase (en, ta, hi) instead of English for everything.

## 6 · Three layers of coverage: the answer to "cover every video"

> **The honest starting point.** YouTube search cannot list every video on a topic (section 3). So the plan stops treating search as the source of truth and uses it only for discovery.

**Layer 1 · Channels are the unit of coverage.** Every video we find tells us its channel. We keep a `channels` table and follow any channel that produced at least one on-topic video. For a followed channel, every new upload reaches us two ways: the free push notification the moment it is uploaded, and a daily sweep of the channel's upload list (1 unit per channel) as the safety net. Health-diet YouTube is a few hundred channels. This is how every upcoming video is caught without spending a single search.

**Layer 2 · Searches only discover what channels cannot.** Each phrase runs newest-first (`order=date`, `publishedAfter` = last time it ran) once every 3 days: 90 phrases = 30 searches a day. Plus 10 relevance searches a day with no date filter, so old evergreen videos keep surfacing. That leaves 60 searches a day for the backfill.

**Layer 3 · Backfill January to September by month.** Per phrase, one page of 50 per month window, most-viewed first (`order=viewCount`), so the tail is cut by value. 90 phrases × 9 months = 810 searches, about 14 days at 60 a day, then the job switches itself off. Every video found joins the watch list; every channel found becomes a follow candidate. The month windows also defeat the 500-result cap.

Coverage is measured, not assumed: a check compares a followed channel's real upload list with what the radar has, and reports the miss rate on the YouTube page.

## 7 · Reading comments: change detection instead of age rules

1. **One cheap call tells us which videos changed.** `videos.list` refreshes the comment count of 50 videos for 1 unit. 5,000 videos on the watch list cost 100 units a day to check.
2. **Read only what moved.** A video's comments are read when its count changed (up or down; deletions lower it), when the video is under 7 days old (counts lag, so fresh videos are read every run regardless), or when it has not been read for 7 days. Shorts are read weekly only.
3. **Read to the cursor, not to a fixed 50.** Every video keeps "newest comment time seen". A read pages newest-first (`order=time`, 100 per page) until it meets that time, so a busy video never loses comments to a window. A quiet video costs 1 unit and returns nothing new.
4. **First read of an old video pages to 1 January 2026.** With a cap (30 pages = 3,000 comments) and a resume token, so a huge video is spread over several runs.
5. **Replies come free.** `part=snippet,replies` on the same call returns a limited set of replies per thread, so a question asked as a reply is often seen. Planned, not built: fetching the remaining replies for threads that scored well.
6. **Everything after that is unchanged:** keyword filter, AI form, score, Today list.

| Estimate | Meaning |
|---|---|
| ~100 units a day | to check 5,000 videos for change |
| ~900 units a day | to read the ~500 videos that changed, at ~1.5 pages each |
| 20,000+ videos | fit on the watch list inside 10,000 units a day |

The numbers are estimates from the call costs in section 3; the ledger in section 8 will replace them with measured ones after the first week.

## 8 · Storage and the rules we keep

| Rule | How it is kept |
|---|---|
| 30-day storage (YouTube policy) | Every item gets `last_seen_at`, refreshed whenever the same comment id comes back from YouTube. Items are deleted 30 days after last seen. Video and channel rows are refreshed by the daily statistics call, so they are never older than 30 days either. This replaces today's 7-day rule. |
| Tag the question, never the person | Unchanged. No commenter name or channel id is stored. The commenter's channel id is compared in memory with the video's channel, so the creator's own and pinned comments are dropped, then discarded. |
| Nothing from before 1 January 2026 | A floor date in the keyword filter replaces today's "older than 7 days" drop. |
| Same question under many videos | A hash of the normalised text; the second copy is marked a duplicate. |
| Never exceed the allowance | A `quota_ledger` row per quota day. Every YouTube call adds its cost before it is made; jobs stop at 95 searches / 9,000 units and resume after the reset; a `quotaExceeded` reply ends the run cleanly. |
| Never run twice at once | Planned: a run lock. Not built; overlaps are harmless because everything is stored by id and cursors move only after comments are saved. |

**New tables (built):** `videos` · `channels` · `topics` · `sweep_units` · `quota_ledger` · `items` gains `last_seen_at` and `video_id` (`text_hash` not built)

## 9 · Schedule and the daily budget

| Job | When | Does |
|---|---|---|
| collect (reader) | every 2 hours | Reads the videos that are due (section 7), filters, queues the AI. |
| discover | every 12 hours | Half the day's newest-first searches and relevance searches; the uploads sweep of followed channels; statistics refresh. |
| backfill | every 2 hours from 1 PM IST, until done | The next month windows, at most 60 searches per quota day. Switches itself off when every phrase and month is done. |
| push renew | daily | Re-subscribes channels whose push lease ends within 3 days. |
| process | hourly at :30 | Unchanged: leftover AI jobs. |
| cleanup | daily | 30-day last-seen purge; unfollows channels with no on-topic video in 120 days. |

Plus one non-cron route, `/api/youtube/push`, that answers Google's subscription check and receives upload notifications. A notified video is scheduled for reads at +6 hours, +1 day, +3 days and +7 days, because comments arrive after the upload, not with it. (Not built. Built schedule: collect every 2 h, sweep every 2 h, discover every 6 h, channels daily 08:30 UTC, process hourly, cleanup daily, coverage Mondays 09:00 UTC.)

**Where the free allowance goes, per day**

| Call | While backfilling | After | Allowance |
|---|---|---|---|
| search.list: newest-first discovery | 30 | 30 | 100 searches |
| search.list: relevance, no date filter | 10 | 10 | (same bucket) |
| search.list: backfill | ≤ 60 | 0 | (same bucket) |
| videos.list: comment counts (5,000 videos) | ~100 | ~100 | 10,000 units |
| playlistItems.list: uploads sweep (500 channels) | ~500 | ~500 | (same bucket) |
| commentThreads.list: reads | ~2,000 (first reads of backfilled videos) | ~900 | (same bucket) |
| channels.list, comments.list | < 100 | < 100 | (same bucket) |

## 10 · Edge cases and how each is handled

**Finding videos**

| Situation | What would go wrong | Handling |
|---|---|---|
| Search stops at ~500 results | Long tail never seen | Month windows in the backfill; newest-first with a date floor for ongoing discovery. |
| Search results drift day to day | A video seen once is lost | Once seen, a video is on the watch list for good; its channel is followed. Search is never the index. |
| Same video under several phrases | Read twice, counted twice | Video id is the primary key; the phrases that found it are stored as a list. |
| Old evergreen video still getting questions | Today's 90-day filter throws it away | Relevance searches carry no date filter; reads are driven by comment-count change, not by video age. |
| Brand-new upload with no comments yet | Read once at 0 comments, then forgotten | Under 7 days old is read every run (built); scheduled reads at +6 h, +1 d, +3 d, +7 d were planned, not built. |
| Shorts | Many comments, low quality, quota drain | Flagged by duration; kept, read weekly only (founder's decision). |
| Live streams and premieres | Live chat is not comments | `liveBroadcastContent` says live or upcoming; skip until it is a normal video. |
| Push notification missed or late | Upload not seen | The daily uploads sweep catches it; push only makes it faster. |
| Push lease expires | Silence after 10 days | Daily renewal job for leases ending within 3 days. |
| Channel goes off-topic or dead | Watch list bloat | Unfollow after 120 days without an on-topic video; the sweep costs stop. |

**Reading comments**

| Situation | What would go wrong | Handling |
|---|---|---|
| Comments disabled, video removed or private | 403 / 404 on every run | Video marked inactive, never read again. Its items stay until the 30-day purge; the link may open a removed video (accepted). |
| Comment deleted or edited after we stored it | Card link opens the video without the highlight | Accepted. Not worth quota to chase. On the next read of a fresh window, ids that vanished can be marked gone at no cost. |
| Creator's own comments, pinned comments | Noise, and a name we must not store | Channel id compared in memory with the video's channel, then discarded. |
| Question asked in a reply | Missed today (top-level only) | `part=replies` gives 5 free; the rest only for threads that already scored well. |
| Video with thousands of comments | One read eats the budget | Page cap and resume token; most-viewed videos first in the backfill so the cap lands where it matters. |
| Comment count lags behind reality | Change detection misses a new comment | Fresh videos read every run; every video read at least weekly regardless. |
| Tamil, Hindi, Tanglish, Hinglish | Today's English keyword list drops them before the AI | Keyword lists and question words in all five forms (section 11); the AI already reports the language. |
| Spam, promo links, competitor staff | Reach the AI, waste calls | Block list unchanged; links and phone numbers block. |
| Same question pasted under many videos | Shown twice | Text hash. |

**Quota, infrastructure, product**

| Situation | What would go wrong | Handling |
|---|---|---|
| Allowance runs out mid-run | Half-read videos, errors | Ledger stops jobs at 95 searches / 9,000 units; a `quotaExceeded` reply ends the run cleanly; everything resumes after the reset. |
| Reset is at 12:30 PM IST | Backfill starts at the wrong hour and starves the readers | Backfill scheduled from 1 PM IST; readers keep their share. |
| Broken request | Still costs 1 | Parameters validated in code before the call. |
| Two cron fires overlap | Same video read twice | Planned: run lock (not built). Built: repeats are ignored by id; schedules are staggered. |
| Host's time limit per call | Job cut off | Built: each job stops at a time budget (150 to 240 s), saves its position, and the next scheduled run continues. |
| Free database pauses after a week idle | Everything stops | Cron traffic keeps it awake, as today. |
| More items reach the AI | Free AI keys exhausted | Strict keyword filter stays; keys rotate; when all are parked the queue waits without spending attempts (already built). |
| January comments look stale | Old questions crowd Today | The age penalty is at most 14 points, so an old comment with a high fit can still rank above a fresh one. "Latest" order shows newest first. Since 21 Sep 2026 the Shortlist page shows only comments posted in the last 30 days with a score of 70 or more; the YouTube page still lists everyone. |
| Dosage, diagnosis, emergency | Must never be approached | Unchanged "not suitable" rule, matching Hash's own disclaimer. |
| Competitor channels moderate their comments | Fewer complaints there | Still read; expect questions rather than complaints; independent review videos are the complaint source. |

## 11 · Decisions taken on 17 September 2026

| Decision | Consequence |
|---|---|
| No quota extension for now | Everything above fits 100 searches and 10,000 units a day. The extension becomes necessary only past roughly 20,000 watched videos or 1,000 followed channels. |
| Languages: English, Tamil, Hindi, Tanglish, Hinglish | Topic map gets Tamil and Hindi phrases in native script and romanised forms. The keyword filter learns the words people actually type ("sugar" for diabetes, "sakkarai noi", "madhumeh", "thyroid ki goli", "BP ki dawai"). The question check accepts Tamil and Hindi question words (என்ன, எப்படி, क्या, कैसे) and their romanised forms ("enna", "epdi", "kya", "kaise"), not only "?" and English words. Search ranking language is set per phrase. The AI's language field is shown as a chip on the card (built for non-English, but the AI's options are only en, hinglish and other, so Tamil shows as "other"). |
| Shorts included, lower priority | Read weekly instead of on every count change. |

This supersedes the earlier "300 most-viewed videos per topic" choice: the backfill now takes the first page of 50 most-viewed videos per phrase per month, up to 450 per phrase for the year.

## 12 · Build order, when approved

1. **Measure first.** Quota ledger, the `topics` table seeded from section 5, and the coverage check. No behaviour change yet; the YouTube page shows units used today.
2. **Watch list.** `videos`, `channels`, `last_seen_at`, the change-detection reader with cursor paging, the 30-day purge, the run lock (not built), the multilingual keyword filter (not built).
3. **Channel following.** Uploads sweep, the push route, lease renewal.
4. **Backfill.** Month windows, self-unscheduling, the month filter on the YouTube page.
5. **Pages and docs.** YouTube page watch-list box (videos, channels, units today, backfill progress, coverage miss rate), How-it-works rewrite, `docs/youtube.html` sections 3, 8, 9 and 10.

**Files.** New: `supabase/migrations/0003_watchlist.sql`, `src/lib/collectors/youtube-api.ts` (shared calls + ledger), `youtube-discover.ts`, `youtube-reader.ts`, `youtube-channels.ts`, `src/lib/watchlist.ts`, cron routes `discover`, `backfill`, `push-renew`, and `src/app/api/youtube/push/route.ts`. Changed: `youtube.ts`, `pipeline/run.ts`, `prefilter.ts`, `config.ts`, `0002_cron.sql`, the three pages, the docs, the tests.

**How we will know it works**

- Unit tests for due-video selection, cursor paging, month-window generation, the ledger stop, push feed parsing, the 30-day cutoff, and the Tamil and Hindi question check.
- By hand: run discover, backfill and collect once each with `?wait=1` and check the ledger, the rows, and the posted dates.
- After one week: for 20 followed channels, upload list versus our videos table must match 100%; for 10 phrases, a manual YouTube search (newest) versus our table, misses noted.
- Google Cloud console: searches at or under 100 a day, units at or under 10,000.

## 13 · Not decided yet

- **When to start building.** Decided: the core of Part 2 was built on 17 Sep 2026 (see the status note at the top).
- **The exact phrase list.** Section 5 shows examples; the full list, especially the Tamil and Hindi forms, needs your review before it is seeded.
- **Which channels to follow first.** Built as automatic: any channel behind a phrase-found video is followed.
- **Should Today mix January comments with this week's**, or show old ones only on the YouTube page.
- **Replies beyond the first 5**: fetch for threads scoring 60 or more, or never.
- **Region bias**: whether to pass `regionCode=IN` on English phrases.

---

*Internal document for the Hash Health team. Part 1 was read from hashhealth.io, Google's YouTube reference pages and the sources named in each section on 17 Sep 2026. Part 2 is the proposal; its core was built on 17 Sep 2026, and `docs/coverage-plan.html` describes what exists in code.*
