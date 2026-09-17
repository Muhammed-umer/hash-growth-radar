import "server-only";
import { YT } from "../config";
import { QuotaExhausted, YouTubeApiError, type PlaylistVideo } from "./api";
import type { YouTubeContext } from "./client";
import { QuotaBudgetReached } from "./quota";
import { toSeed } from "./rules";
import { knownVideoIds, randomFollowedChannels, upsertVideos } from "./watchlist";

/**
 * Job 8 · Coverage check (docs/coverage-plan.html section 9). Lists the real
 * upload list of a random sample of followed channels (to the same depth the
 * history walk reads) and counts the videos we do not have. The count is the
 * miss rate shown on the YouTube page, and the misses are stored on the spot.
 * A channel that cannot be listed completely in this run is left out of the
 * rate rather than counted half.
 */
export async function runCoverage(ctx: YouTubeContext, opts: { timeBudgetMs?: number } = {}): Promise<Record<string, unknown>> {
  const { client, ledger } = ctx;
  const deadline = Date.now() + (opts.timeBudgetMs ?? YT.job_time_budget_ms);
  const notes: Record<string, unknown> = { channels_checked: 0, videos_on_channels: 0, missing: 0, pages: 0, errors: 0 };
  const bump = (k: string, n = 1) => (notes[k] = (notes[k] as number) + n);
  const missingBy: Record<string, number> = {};
  let stopped: string | null = null;

  try {
    for (const ch of await randomFollowedChannels(YT.coverage_sample)) {
      if (Date.now() >= deadline) {
        stopped = "time budget";
        break;
      }
      const seen: PlaylistVideo[] = [];
      let token: string | undefined;
      let pages = 0;
      let complete = false;
      try {
        while (true) {
          const page = await client.playlistItemsList(ch.uploads_playlist_id!, token);
          pages++;
          bump("pages");
          seen.push(...page.items);
          token = page.nextPageToken ?? undefined;
          if (!token || pages >= YT.channel_history_max_pages) {
            complete = true;
            break;
          }
          if (Date.now() >= deadline) break;
        }
      } catch (e) {
        if (e instanceof QuotaExhausted || e instanceof QuotaBudgetReached) throw e;
        if (!(e instanceof YouTubeApiError && e.status === 404)) {
          bump("errors");
          notes.last_error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        }
        continue;
      }
      if (!complete) {
        stopped = "time budget";
        break;
      }
      const known = await knownVideoIds(seen.map((v) => v.videoId));
      const missing = seen.filter((v) => !known.has(v.videoId));
      bump("channels_checked");
      bump("videos_on_channels", seen.length);
      bump("missing", missing.length);
      if (missing.length) {
        missingBy[ch.channel_id] = missing.length;
        await upsertVideos(missing.map(toSeed), null, "coverage");
      }
    }
  } catch (e) {
    stopped = e instanceof Error ? e.message : String(e);
    if (!(e instanceof QuotaExhausted || e instanceof QuotaBudgetReached)) notes.error = stopped.slice(0, 300);
  }

  const total = notes.videos_on_channels as number;
  const q = await ledger.today();
  return {
    ...notes,
    miss_rate_pct: total ? Math.round(((notes.missing as number) / total) * 1000) / 10 : 0,
    missing_by_channel: missingBy,
    stopped,
    searches_today: q.searches,
    units_today: q.units,
  };
}
