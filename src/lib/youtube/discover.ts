import "server-only";
import { config, YT } from "../config";
import { QuotaExhausted } from "./api";
import type { YouTubeContext } from "./client";
import { QuotaBudgetReached } from "./quota";
import { iso, newSinceAfter, relevanceDue, toSeed } from "./rules";
import { insertSweepUnits, seedTopics, updateTopic, upsertVideos } from "./watchlist";

function isQuotaStop(e: unknown): boolean {
  return e instanceof QuotaExhausted || e instanceof QuotaBudgetReached;
}

/**
 * Jobs 2 + 3 · New videos (docs/coverage-plan.html section 6).
 *
 * Per phrase: "newest first, published after the last time we looked", up to
 * YT.discover_pages_per_topic pages. If more pages remain, the older part of
 * that window is handed to the sweep as its own unit, so nothing is dropped.
 * Only then does the watermark move to this run's start time; a phrase whose
 * search failed keeps its old watermark and is caught up next run.
 * Once a day per phrase: one plain relevance search, no date filter.
 */
export async function runDiscover(ctx: YouTubeContext): Promise<Record<string, unknown>> {
  const { client, ledger, now } = ctx;
  const topics = await seedTopics(config().youtube_topics);
  const notes: Record<string, unknown> = { topics: topics.length, new_searches: 0, relevance_searches: 0, videos_seen: 0, videos_new: 0, handed_to_sweep: 0, errors: 0 };
  const bump = (k: string, n = 1) => (notes[k] = (notes[k] as number) + n);
  let stopped: string | null = null;

  for (const t of topics) {
    try {
      // Newest since the watermark.
      const after = newSinceAfter(t.last_new_search_at, now);
      let token: string | undefined;
      let pages = 0;
      let oldestSeen: string | null = null;
      do {
        const page = await client.searchList({ q: t.phrase, order: "date", publishedAfter: iso(after), relevanceLanguage: t.language, pageToken: token });
        pages++;
        bump("new_searches");
        bump("videos_seen", page.items.length);
        bump("videos_new", await upsertVideos(page.items.map(toSeed), t.phrase, "search_new"));
        for (const v of page.items) {
          if (v.publishedAt && (!oldestSeen || Date.parse(v.publishedAt) < Date.parse(oldestSeen))) oldestSeen = v.publishedAt;
        }
        token = page.nextPageToken ?? undefined;
      } while (token && pages < YT.discover_pages_per_topic);

      if (token && oldestSeen && Date.parse(oldestSeen) > after.getTime()) {
        // More new videos than discover reads: the sweep takes the rest of the window.
        await insertSweepUnits([{ phrase: t.phrase, published_after: iso(after), published_before: oldestSeen, order_by: "date" }]);
        bump("handed_to_sweep");
      }
      await updateTopic(t.phrase, { last_new_search_at: iso(now) });

      // The daily relevance net.
      if (relevanceDue(t.last_relevance_search_at, now)) {
        const page = await client.searchList({ q: t.phrase, order: "relevance", relevanceLanguage: t.language });
        bump("relevance_searches");
        bump("videos_seen", page.items.length);
        bump("videos_new", await upsertVideos(page.items.map(toSeed), t.phrase, "search_relevance"));
        await updateTopic(t.phrase, { last_relevance_search_at: iso(now) });
      }
    } catch (e) {
      if (isQuotaStop(e)) {
        stopped = (e as Error).message;
        break;
      }
      // One phrase failing must not block the others; its watermark did not move.
      bump("errors");
      notes.last_error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    }
  }

  const q = await ledger.today();
  return { ...notes, stopped, searches_today: q.searches, units_today: q.units };
}
