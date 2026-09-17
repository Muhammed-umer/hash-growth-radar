import "server-only";
import { YT } from "../config";
import type { CollectorResult } from "../collectors/types";
import type { RawItem, VideoRow } from "../types";
import { isBadPageToken, QuotaExhausted, YouTubeApiError } from "./api";
import type { YouTubeContext } from "./client";
import { QuotaBudgetReached } from "./quota";
import { decideRead, iso, nextCheckAt, pickComments, shouldRetire, toRawItems, type CheckedVideo } from "./rules";
import { patchVideos, videosDueForCheck } from "./watchlist";

type Patch = Partial<VideoRow> & { video_id: string };

const HOUR = 3_600_000;
/** Consecutive unexplained read errors after which the run stops (YouTube or the network is down). */
const MAX_ERRORS_IN_A_ROW = 5;

function isQuotaStop(e: unknown): boolean {
  return e instanceof QuotaExhausted || e instanceof QuotaBudgetReached;
}

/**
 * Job 6 · The comment reader (docs/coverage-plan.html section 6). This is the
 * "collect" run: it returns RawItems for the unchanged pipeline (dedupe,
 * keyword filter, AI, score).
 *
 * 1. videos.list, 50 ids per unit, for every active video whose check is due:
 *    refresh the comment count and mark gone / live / short / retired.
 * 2. Read only what the rules say (count moved, fresh, weekly re-read, or an
 *    unfinished read): commentThreads newest first, page until the cursor,
 *    with per-video and per-run page caps. An unfinished read keeps its page
 *    token and continues next run.
 * 3. Return the comments plus a `commit` that saves the video rows. The
 *    pipeline calls commit only AFTER the comments are stored, so a cursor can
 *    never move past comments that were not saved.
 *
 * Nothing that happens mid-run loses data: the quota running out, the time
 * budget, or an unexplained error all end the run with what was read so far,
 * and every video that was selected but not read keeps its OLD comment count,
 * so the change is detected again next run.
 */
export async function runReader(ctx: YouTubeContext, opts: { timeBudgetMs?: number } = {}): Promise<CollectorResult> {
  const { client, ledger, now } = ctx;
  const deadline = Date.now() + (opts.timeBudgetMs ?? YT.reader_time_budget_ms);
  const nowIso = iso(now);
  const items: RawItem[] = [];
  const notes: Record<string, unknown> = {
    videos_checked: 0, videos_changed: 0, videos_gone: 0, videos_retired: 0, videos_to_read: 0, videos_read: 0,
    pages: 0, comments_seen: 0, comments_kept: 0, comments_disabled: 0, unfinished: 0, read_errors: 0, token_resets: 0,
  };
  const bump = (k: string, n = 1) => (notes[k] = (notes[k] as number) + n);
  let stopped: string | null = null;
  const orig = new Map<string, VideoRow>();
  const patches = new Map<string, Patch>();
  const toRead: CheckedVideo[] = [];
  const handled = new Set<string>();

  const unitsLeft = async () => ledger.canSpend("units", 1, YT.reader_unit_cap);

  /** Selected but not read (or read failed): keep the old count so the change is seen again. */
  const postpone = (videoId: string, until: Date) => {
    const o = orig.get(videoId);
    const p = patches.get(videoId) ?? { video_id: videoId };
    patches.set(videoId, {
      ...p,
      comment_count: o?.comment_count ?? null,
      last_change_at: o?.last_change_at ?? null,
      next_check_at: iso(until),
    });
  };

  try {
    // 1. Count check.
    const due = await videosDueForCheck(now, YT.checks_per_run);
    for (const v of due) orig.set(v.video_id, v);
    for (let i = 0; i < due.length; i += 50) {
      if (Date.now() >= deadline) {
        stopped = "time budget (count check)";
        break;
      }
      if (!(await unitsLeft())) {
        stopped = `reader unit cap (${YT.reader_unit_cap}) reached for today`;
        break;
      }
      const batch = due.slice(i, i + 50);
      const details = await client.videosList(batch.map((v) => v.video_id));
      const byId = new Map(details.map((d) => [d.videoId, d]));
      for (const v of batch) {
        bump("videos_checked");
        const d = byId.get(v.video_id);
        if (!d) {
          patches.set(v.video_id, { video_id: v.video_id, status: "gone", count_checked_at: nowIso });
          handled.add(v.video_id);
          bump("videos_gone");
          continue;
        }
        const changed = v.comment_count === null ? d.commentCount !== null || v.last_read_at === null : d.commentCount !== v.comment_count;
        if (changed) bump("videos_changed");
        const base: Patch = {
          video_id: v.video_id,
          channel_id: d.channelId ?? v.channel_id,
          channel_title: d.channelTitle ?? v.channel_title,
          title: d.title ?? v.title,
          published_at: d.publishedAt ?? v.published_at,
          duration_seconds: d.durationSeconds ?? v.duration_seconds,
          is_short: (d.durationSeconds ?? v.duration_seconds ?? 999) < 60,
          is_live: d.live,
          comment_count: d.commentCount,
          count_checked_at: nowIso,
          last_change_at: changed ? nowIso : v.last_change_at,
          last_seen_at: nowIso,
        };
        const merged = { ...v, ...base } as VideoRow;
        if (!changed && !v.read_resume_token && shouldRetire(merged, now)) {
          patches.set(v.video_id, { ...base, status: "retired" });
          handled.add(v.video_id);
          bump("videos_retired");
          continue;
        }
        patches.set(v.video_id, base);
        if (decideRead({ row: merged, fresh: d, changed }, now)) {
          toRead.push({ row: merged, fresh: d, changed });
        } else {
          const next = d.live ? new Date(now.getTime() + 6 * HOUR) : nextCheckAt(merged, changed, now);
          patches.set(v.video_id, { ...base, next_check_at: iso(next) });
          handled.add(v.video_id);
        }
      }
    }
    notes.videos_to_read = toRead.length;

    // 2. Read: unfinished reads first, then changed, then the rest, busiest first.
    const rank = (c: CheckedVideo) => (c.row.read_resume_token ? 0 : c.changed ? 1 : 2);
    toRead.sort((a, b) => rank(a) - rank(b) || (b.fresh.commentCount ?? 0) - (a.fresh.commentCount ?? 0));

    let pagesThisRun = 0;
    let reads = 0;
    let errorsInRow = 0;
    for (const c of toRead) {
      if (stopped) break;
      if (reads >= YT.reads_per_run || pagesThisRun >= YT.pages_per_run) {
        stopped = "read caps for this run";
        break;
      }
      if (Date.now() >= deadline) {
        stopped = "time budget (reading)";
        break;
      }
      const v = c.row;
      const base = patches.get(v.video_id) ?? { video_id: v.video_id };
      let token = v.read_resume_token ?? undefined;
      let pending = v.pending_newest_at;
      let pages = 0;
      let finished = false;
      const firstRead = v.newest_comment_at === null;
      try {
        while (true) {
          if (!(await unitsLeft())) {
            stopped = `reader unit cap (${YT.reader_unit_cap}) reached for today`;
            break;
          }
          const sentToken = token;
          let page;
          try {
            page = await client.commentThreadsList(v.video_id, token);
          } catch (e) {
            if (isBadPageToken(e, sentToken !== undefined)) {
              // The saved position expired: start this video's read again from the top.
              patches.set(v.video_id, { ...base, read_resume_token: null, pending_newest_at: null, read_pages_total: 0, next_check_at: nowIso });
              handled.add(v.video_id);
              bump("token_resets");
              break;
            }
            throw e;
          }
          pages++;
          pagesThisRun++;
          bump("pages");
          const picked = pickComments(page.items, { cursor: v.newest_comment_at, floor: YT.comment_floor, videoChannelId: v.channel_id });
          bump("comments_seen", page.items.reduce((n, t) => n + 1 + t.replies.length, 0));
          bump("comments_kept", picked.comments.length);
          items.push(...toRawItems(picked.comments, v));
          if (picked.newest && (!pending || Date.parse(picked.newest) > Date.parse(pending))) pending = picked.newest;
          token = page.nextPageToken ?? undefined;
          if (picked.reachedCursor || !token) {
            finished = true;
            break;
          }
          if (firstRead && v.read_pages_total + pages >= YT.first_read_max_pages) {
            finished = true; // deep enough for a first read of an old video
            break;
          }
          if (pages >= YT.pages_per_video_per_run || pagesThisRun >= YT.pages_per_run || Date.now() >= deadline) break;
        }
      } catch (e) {
        if (isQuotaStop(e)) {
          stopped = (e as Error).message;
        } else if (e instanceof YouTubeApiError && e.reason === "commentsDisabled") {
          patches.set(v.video_id, { ...base, status: "comments_disabled", read_resume_token: null });
          handled.add(v.video_id);
          bump("comments_disabled");
          errorsInRow = 0;
          continue;
        } else if (e instanceof YouTubeApiError && (e.reason === "videoNotFound" || e.status === 404)) {
          patches.set(v.video_id, { ...base, status: "gone", read_resume_token: null });
          handled.add(v.video_id);
          bump("videos_gone");
          errorsInRow = 0;
          continue;
        } else {
          // Anything else (a 403 we do not know, a network failure after retries):
          // leave this video as it was and try it again in a day.
          bump("read_errors");
          notes.last_read_error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
          if (pages === 0) {
            postpone(v.video_id, new Date(now.getTime() + 24 * HOUR));
            handled.add(v.video_id);
          }
          errorsInRow++;
          if (errorsInRow >= MAX_ERRORS_IN_A_ROW) {
            stopped = `${MAX_ERRORS_IN_A_ROW} read errors in a row: ${notes.last_read_error}`;
            break;
          }
          if (pages === 0) continue;
        }
      }
      if (handled.has(v.video_id)) continue;
      if (pages === 0) continue; // stopped before the first page: postponed below
      errorsInRow = 0;
      reads++;
      bump("videos_read");
      handled.add(v.video_id);
      if (finished) {
        const cursor = pending && (!v.newest_comment_at || Date.parse(pending) > Date.parse(v.newest_comment_at)) ? pending : v.newest_comment_at;
        patches.set(v.video_id, {
          ...base,
          newest_comment_at: cursor,
          pending_newest_at: null,
          read_resume_token: null,
          read_pages_total: 0,
          last_read_at: nowIso,
          next_check_at: iso(nextCheckAt(v, c.changed, now)),
        });
      } else {
        // Part-way through: keep the page position and continue at the next run.
        bump("unfinished");
        patches.set(v.video_id, {
          ...base,
          pending_newest_at: pending,
          read_resume_token: token ?? null,
          read_pages_total: v.read_pages_total + pages,
          last_read_at: nowIso,
          next_check_at: nowIso,
        });
      }
    }
  } catch (e) {
    // Quota, or an error outside a single video's read (e.g. videos.list or the
    // database). Keep what was read; everything not handled is postponed below.
    stopped = e instanceof Error ? e.message : String(e);
    if (!isQuotaStop(e)) notes.error = stopped.slice(0, 300);
  }

  for (const c of toRead) {
    if (!handled.has(c.row.video_id)) postpone(c.row.video_id, now);
  }

  const q = await ledger.today();
  return {
    items,
    notes: { ...notes, stopped, searches_today: q.searches, units_today: q.units },
    commit: () => patchVideos([...patches.values()]),
  };
}
