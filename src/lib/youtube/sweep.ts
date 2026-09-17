import "server-only";
import { config, YT } from "../config";
import { isBadPageToken, QuotaExhausted } from "./api";
import type { YouTubeContext } from "./client";
import { QuotaBudgetReached } from "./quota";
import { buildSweepUnits, iso, splitWindow, sweepPageOutcome, toSeed } from "./rules";
import { insertSweepUnits, nextSweepUnit, seedTopics, updateSweepUnit, updateTopic, upsertVideos } from "./watchlist";

/**
 * Job 1 · The one-time month sweep (docs/coverage-plan.html section 6).
 *
 * For every active phrase, every month back to the floor, in two orders,
 * newest month first: search all pages, store every video, save the page
 * token after every page. Stops at the time budget or when the day's searches
 * reach YT.sweep_search_cap, and continues next run. A phrase added to config
 * later gets its own months on the next run. When no unit is left it reports
 * "finished" and does nothing more. The discover job can also hand it a
 * window that had more new videos than discover reads.
 */
export async function runSweep(ctx: YouTubeContext, opts: { timeBudgetMs?: number } = {}): Promise<Record<string, unknown>> {
  const { client, ledger, now } = ctx;
  const deadline = Date.now() + (opts.timeBudgetMs ?? YT.job_time_budget_ms);

  const topics = await seedTopics(config().youtube_topics);
  const floor = new Date(YT.sweep_floor);
  let seededNow = 0;
  for (const t of topics) {
    if (t.sweep_seeded_at) continue;
    await insertSweepUnits(buildSweepUnits([t.phrase], floor, now));
    await updateTopic(t.phrase, { sweep_seeded_at: iso(now), last_new_search_at: t.last_new_search_at ?? iso(now) });
    seededNow++;
  }
  const phrases = topics.map((t) => t.phrase);
  const language = new Map(topics.map((t) => [t.phrase, t.language]));

  const notes: Record<string, unknown> = { seeded_topics: seededNow, units_done: 0, pages: 0, videos_seen: 0, videos_new: 0, splits: 0, too_dense: 0, token_resets: 0 };
  const bump = (k: string, n = 1) => (notes[k] = (notes[k] as number) + n);
  let stopped = "time budget";

  try {
    while (true) {
      if (Date.now() >= deadline) {
        stopped = "time budget";
        break;
      }
      if (!(await ledger.canSpend("searches", 1, YT.sweep_search_cap))) {
        stopped = `sweep search cap (${YT.sweep_search_cap}) reached for today`;
        break;
      }
      const unit = await nextSweepUnit(phrases);
      if (!unit) {
        stopped = "finished: every phrase and month is done";
        break;
      }

      let page;
      try {
        page = await client.searchList({
          q: unit.phrase,
          order: unit.order_by,
          publishedAfter: unit.published_after,
          publishedBefore: unit.published_before,
          relevanceLanguage: language.get(unit.phrase) ?? "en",
          pageToken: unit.page_token ?? undefined,
        });
      } catch (e) {
        if (unit.page_token && isBadPageToken(e, true)) {
          // Tokens are opaque and not guaranteed to live; re-read the window from page 1.
          await updateSweepUnit(unit.id, { page_token: null, pages_done: 0, videos_found: 0, status: "pending" });
          bump("token_resets");
          continue;
        }
        throw e;
      }

      bump("pages");
      bump("videos_seen", page.items.length);
      bump("videos_new", await upsertVideos(page.items.map(toSeed), unit.phrase, "sweep"));

      const pagesDone = unit.pages_done + 1;
      const found = unit.videos_found + page.items.length;
      const outcome = sweepPageOutcome({ pagesDone, pageItems: page.items.length, videosFound: found, hasNextPage: !!page.nextPageToken });
      if (outcome === "continue") {
        await updateSweepUnit(unit.id, { status: "in_progress", page_token: page.nextPageToken, pages_done: pagesDone, videos_found: found });
        continue;
      }
      // done or split. The halves are inserted BEFORE the window is closed, so a
      // crash in between re-reads one page at worst and never loses the halves.
      if (outcome === "split") {
        const halves = splitWindow(unit);
        if (halves) {
          await insertSweepUnits(halves);
          bump("splits");
        } else {
          bump("too_dense"); // under 2 days and still capped: kept what search gives
        }
      }
      await updateSweepUnit(unit.id, { status: "done", page_token: null, pages_done: pagesDone, videos_found: found });
      bump("units_done");
    }
  } catch (e) {
    stopped = e instanceof Error ? e.message : String(e);
    if (!(e instanceof QuotaExhausted || e instanceof QuotaBudgetReached)) notes.error = stopped.slice(0, 300);
  }

  const t = await ledger.today();
  return { ...notes, stopped, searches_today: t.searches, units_today: t.units };
}
