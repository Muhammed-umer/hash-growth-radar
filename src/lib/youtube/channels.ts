import "server-only";
import { YT } from "../config";
import { isBadPageToken, QuotaExhausted, YouTubeApiError } from "./api";
import type { YouTubeContext } from "./client";
import { QuotaBudgetReached } from "./quota";
import { iso, toSeed } from "./rules";
import { channelsDueForSweep, channelsNeedingPlaylist, channelsNeedingWalk, knownVideoIds, patchChannels, upsertVideos } from "./watchlist";

const HOUR = 3_600_000;
const MAX_ERRORS_IN_A_ROW = 5;

function isQuotaStop(e: unknown): boolean {
  return e instanceof QuotaExhausted || e instanceof QuotaBudgetReached;
}

function isGone(e: unknown): boolean {
  return e instanceof YouTubeApiError && (e.status === 404 || e.reason === "playlistNotFound" || e.reason === "channelNotFound");
}

/**
 * Job 4 · Channel uploads (docs/coverage-plan.html section 6). Nothing here spends a search.
 *
 * 1. New followed channels: one channels.list call per 50 gives the uploads playlist id.
 * 2. Walked channels not listed for a day: the newest page, another page only
 *    if every video on it was new. This runs BEFORE the history walks so new
 *    uploads are never starved by a long backlog of walks.
 * 3. Channels never walked: read the uploads playlist from newest to oldest.
 *    The page position is saved after every page, so a walk that runs out of
 *    time or units continues next run. A channel with more than
 *    YT.channel_history_max_pages pages is marked walked at that depth.
 */
export async function runChannels(ctx: YouTubeContext, opts: { timeBudgetMs?: number } = {}): Promise<Record<string, unknown>> {
  const { client, ledger, now } = ctx;
  const deadline = Date.now() + (opts.timeBudgetMs ?? YT.job_time_budget_ms);
  const nowIso = iso(now);
  const notes: Record<string, unknown> = {
    resolved: 0, unfollowed: 0, swept: 0, sweep_pages: 0, walked: 0, walk_pages: 0, walks_paused: 0,
    videos_seen: 0, videos_new: 0, errors: 0,
  };
  const bump = (k: string, n = 1) => (notes[k] = (notes[k] as number) + n);
  let stopped: string | null = null;
  let errorsInRow = 0;
  const onError = (e: unknown): boolean => {
    bump("errors");
    notes.last_error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    errorsInRow++;
    if (errorsInRow >= MAX_ERRORS_IN_A_ROW) {
      stopped = `${MAX_ERRORS_IN_A_ROW} errors in a row: ${notes.last_error}`;
      return true;
    }
    return false;
  };

  try {
    // 1. Uploads playlist ids.
    for (let round = 0; round < 10 && !stopped; round++) {
      if (Date.now() >= deadline) {
        stopped = "time budget (resolve)";
        break;
      }
      const batch = await channelsNeedingPlaylist(50);
      if (batch.length === 0) break;
      const details = await client.channelsList(batch.map((c) => c.channel_id));
      const byId = new Map(details.map((d) => [d.channelId, d]));
      await patchChannels(
        batch.map((c) => {
          const d = byId.get(c.channel_id);
          if (!d?.uploadsPlaylistId) {
            bump("unfollowed");
            return { channel_id: c.channel_id, followed: false, last_seen_at: nowIso };
          }
          bump("resolved");
          return { channel_id: c.channel_id, uploads_playlist_id: d.uploadsPlaylistId, title: d.title ?? c.title, last_seen_at: nowIso };
        }),
      );
    }

    // 2. The daily newest page of every walked channel.
    const before = new Date(now.getTime() - YT.channel_sweep_hours * HOUR);
    for (const ch of stopped ? [] : await channelsDueForSweep(before, YT.channels_per_run)) {
      if (Date.now() >= deadline) {
        stopped = "time budget (daily check)";
        break;
      }
      let token: string | undefined;
      let pages = 0;
      try {
        do {
          const page = await client.playlistItemsList(ch.uploads_playlist_id!, token);
          pages++;
          bump("sweep_pages");
          bump("videos_seen", page.items.length);
          const known = await knownVideoIds(page.items.map((v) => v.videoId));
          const fresh = page.items.filter((v) => !known.has(v.videoId));
          bump("videos_new", await upsertVideos(page.items.map(toSeed), null, "channel"));
          // Every video on the page was new: the channel uploaded more than a page since the last check.
          token = fresh.length === page.items.length && page.items.length > 0 ? (page.nextPageToken ?? undefined) : undefined;
        } while (token && pages < 3);
      } catch (e) {
        if (isQuotaStop(e)) throw e;
        if (isGone(e)) {
          await patchChannels([{ channel_id: ch.channel_id, followed: false, last_seen_at: nowIso }]);
          bump("unfollowed");
          continue;
        }
        if (onError(e)) break;
        continue; // not marked swept: tried again next run
      }
      errorsInRow = 0;
      await patchChannels([{ channel_id: ch.channel_id, last_swept_at: nowIso, last_seen_at: nowIso }]);
      bump("swept");
    }

    // 3. History walks, most on-topic channels first, capped in units per run.
    let walkUnits = 0;
    for (const ch of stopped ? [] : await channelsNeedingWalk(200)) {
      if (walkUnits >= YT.channel_walk_units_per_run) {
        stopped = "walk unit budget for this run";
        break;
      }
      if (Date.now() >= deadline) {
        stopped = "time budget (history walks)";
        break;
      }
      let token = ch.walk_page_token ?? undefined;
      let pages = ch.walk_pages;
      let complete = false;
      let failure: unknown = null;
      try {
        while (true) {
          const sent = token;
          let page;
          try {
            page = await client.playlistItemsList(ch.uploads_playlist_id!, token);
          } catch (e) {
            if (sent !== undefined && isBadPageToken(e, true)) {
              // Saved position expired: restart this walk from the newest upload.
              token = undefined;
              pages = 0;
              break;
            }
            throw e;
          }
          pages++;
          walkUnits++;
          bump("walk_pages");
          bump("videos_seen", page.items.length);
          bump("videos_new", await upsertVideos(page.items.map(toSeed), null, "channel"));
          token = page.nextPageToken ?? undefined;
          if (!token || pages >= YT.channel_history_max_pages) {
            complete = true;
            break;
          }
          if (walkUnits >= YT.channel_walk_units_per_run || Date.now() >= deadline) break;
        }
      } catch (e) {
        failure = e;
      }

      if (failure && isGone(failure)) {
        await patchChannels([{ channel_id: ch.channel_id, followed: false, walk_page_token: null, walk_pages: 0, last_seen_at: nowIso }]);
        bump("unfollowed");
        continue;
      }
      // Save the position reached, whatever happened, so nothing is read twice.
      if (complete) {
        await patchChannels([{ channel_id: ch.channel_id, history_walked: true, walk_page_token: null, walk_pages: pages, last_swept_at: nowIso, last_seen_at: nowIso }]);
        bump("walked");
      } else {
        await patchChannels([{ channel_id: ch.channel_id, walk_page_token: token ?? null, walk_pages: pages, last_seen_at: nowIso }]);
        bump("walks_paused");
      }
      if (failure) {
        if (isQuotaStop(failure)) throw failure;
        if (onError(failure)) break;
      } else {
        errorsInRow = 0;
      }
    }
  } catch (e) {
    stopped = e instanceof Error ? e.message : String(e);
    if (!isQuotaStop(e)) notes.error = stopped.slice(0, 300);
  }

  const q = await ledger.today();
  return { ...notes, stopped, searches_today: q.searches, units_today: q.units };
}
