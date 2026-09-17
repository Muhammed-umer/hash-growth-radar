/**
 * The decisions of the watch list as pure functions, so they can be unit
 * tested without YouTube or the database. The jobs in sweep.ts, discover.ts,
 * channels.ts and reader.ts only wire these to the API and the tables.
 */
import { YT } from "../config";
import type { RawItem, SweepOrder, VideoRow } from "../types";
import type { CommentData, PlaylistVideo, SearchVideo, Thread, VideoDetails } from "./api";
import type { VideoSeed } from "./watchlist";

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** RFC 3339 without milliseconds, the form Google's examples use. */
export function iso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function toSeed(v: SearchVideo | PlaylistVideo): VideoSeed {
  return { video_id: v.videoId, channel_id: v.channelId, channel_title: v.channelTitle, title: v.title, published_at: v.publishedAt };
}

// ---------------------------------------------------------------------------
// Month sweep
// ---------------------------------------------------------------------------

export interface SweepWindow {
  phrase: string;
  published_after: string;
  published_before: string;
  order_by: SweepOrder;
}

const SWEEP_ORDERS: SweepOrder[] = ["viewCount", "date"];

/**
 * One unit per (phrase, month, order), NEWEST MONTH FIRST. The current month
 * ends at `now`, which is also the discover watermark, so the sweep covers
 * everything before that instant and discover everything after it.
 */
export function buildSweepUnits(phrases: string[], floor: Date, now: Date): SweepWindow[] {
  const out: SweepWindow[] = [];
  let before = now;
  let monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let guard = 0; guard < 240; guard++) {
    const after = monthStart > floor ? monthStart : floor;
    if (after >= before) break;
    for (const phrase of phrases) {
      for (const order_by of SWEEP_ORDERS) {
        out.push({ phrase, published_after: iso(after), published_before: iso(before), order_by });
      }
    }
    if (monthStart <= floor) break;
    before = monthStart;
    monthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  }
  return out;
}

export type SweepPageOutcome = "continue" | "done" | "split";

/**
 * What to do with a sweep window after one more page came back.
 *
 * YouTube stops paging near 500 results, and it may signal that in two ways:
 * page 10 still carries a next-page token, or the token simply disappears at
 * page 10. The second looks exactly like a month that really ended, so the
 * token alone cannot be trusted at the page cap. At the cap we split when any
 * of these is true:
 *   - there is still a next page,
 *   - the last page came back full (50 videos),
 *   - the window returned at least 80% of the most it could (400 of 500).
 * The 80% allows for pages that come back a few videos short, which YouTube
 * does even in the middle of a result set. A split that was not needed costs
 * a few searches and creates no duplicates, because videos are stored by id.
 * Before the cap, no next page means the window is finished.
 */
export function sweepPageOutcome(p: { pagesDone: number; pageItems: number; videosFound: number; hasNextPage: boolean }, cap: number = YT.sweep_pages_per_window): SweepPageOutcome {
  const PAGE = 50;
  if (p.pagesDone >= cap) {
    const looksCapped = p.hasNextPage || p.pageItems >= PAGE || p.videosFound >= Math.floor(cap * PAGE * 0.8);
    return looksCapped ? "split" : "done";
  }
  return p.hasNextPage ? "continue" : "done";
}

/**
 * A window that hit the ~500 cap is split in two halves, LATER HALF FIRST so
 * the sweep keeps walking backwards. Returns null when the window is already
 * too small to split.
 */
export function splitWindow(u: SweepWindow, minHours = YT.sweep_min_window_hours): [SweepWindow, SweepWindow] | null {
  const a = Date.parse(u.published_after);
  const b = Date.parse(u.published_before);
  if (!(b - a >= 2 * minHours * HOUR)) return null;
  const mid = new Date(a + Math.floor((b - a) / 2));
  return [
    { ...u, published_after: iso(mid) },
    { ...u, published_before: iso(mid) },
  ];
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

/** Where the "newest since last look" search starts. */
export function newSinceAfter(lastNewSearchAt: string | null, now: Date): Date {
  if (!lastNewSearchAt) return new Date(now.getTime() - YT.discover_first_lookback_days * DAY);
  return new Date(Date.parse(lastNewSearchAt) - YT.discover_overlap_hours * HOUR);
}

export function relevanceDue(lastRelevanceAt: string | null, now: Date): boolean {
  if (!lastRelevanceAt) return true;
  return now.getTime() - Date.parse(lastRelevanceAt) >= YT.relevance_every_hours * HOUR;
}

// ---------------------------------------------------------------------------
// Reader: which videos to read, and when to look again
// ---------------------------------------------------------------------------

function ageDays(publishedAt: string | null, now: Date): number {
  if (!publishedAt) return Infinity;
  return (now.getTime() - Date.parse(publishedAt)) / DAY;
}

function daysSince(ts: string | null, now: Date): number {
  if (!ts) return Infinity;
  return (now.getTime() - Date.parse(ts)) / DAY;
}

/** The video row after this run's videos.list refresh (what we know now). */
export interface CheckedVideo {
  row: VideoRow;
  fresh: VideoDetails;
  /** comment_count differs from the stored one (or was never stored). */
  changed: boolean;
}

export type ReadReason = "resume" | "count_changed" | "fresh" | "reread" | "never_read";

/** Should this video's comments be read in this run? */
export function decideRead(c: CheckedVideo, now: Date): ReadReason | null {
  const v = c.row;
  if (c.fresh.live) return null;
  if (v.read_resume_token) return "resume";
  const isShort = (c.fresh.durationSeconds ?? v.duration_seconds ?? 999) < 60;
  const sinceRead = daysSince(v.last_read_at, now);
  if (isShort) return sinceRead >= YT.reread_days ? (v.last_read_at ? "reread" : "never_read") : null;
  if (!v.last_read_at) return "never_read";
  if (c.changed) return "count_changed";
  if (ageDays(v.published_at ?? c.fresh.publishedAt, now) < YT.fresh_days) return "fresh";
  if (sinceRead >= YT.reread_days) return "reread";
  return null;
}

/** When to check the comment count again. */
export function nextCheckAt(v: Pick<VideoRow, "published_at" | "last_change_at" | "first_seen_at">, changed: boolean, now: Date): Date {
  if (changed || ageDays(v.published_at, now) < YT.fresh_days) return new Date(now.getTime() + 2 * HOUR);
  const quiet = daysSince(v.last_change_at ?? v.first_seen_at, now);
  if (quiet < YT.quiet_days) return new Date(now.getTime() + 24 * HOUR);
  return new Date(now.getTime() + 7 * DAY);
}

/** Retired: nothing moved for a long time and the video is old. */
export function shouldRetire(v: Pick<VideoRow, "published_at" | "last_change_at" | "first_seen_at">, now: Date): boolean {
  return daysSince(v.last_change_at ?? v.first_seen_at, now) >= YT.retire_after_days && ageDays(v.published_at, now) >= YT.retire_after_days;
}

// ---------------------------------------------------------------------------
// Reader: one page of threads against the cursor
// ---------------------------------------------------------------------------

export interface PickedComment {
  comment: CommentData;
  /** Set for a reply: the top-level comment it answers. */
  parentId: string | null;
}

export interface PickedPage {
  comments: PickedComment[];
  /** This page reached comments already stored (or older than the floor): stop paging. */
  reachedCursor: boolean;
  /** Newest publish time seen on this page (top-level or reply). */
  newest: string | null;
}

function newer(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Keep every comment not older than the cursor and not before the floor, drop
 * the creator's own comments (author channel == video channel, compared here
 * and then forgotten). A comment exactly at the cursor time is kept: two
 * comments can share a second, and the database ignores the one we already have.
 *
 * Threads come newest first, so a page that reaches the cursor (or the floor)
 * means every later page is already stored or too old. The FIRST thread on a
 * page is not trusted for that decision, because a pinned comment can sit at
 * the top out of time order; with one thread on the page, it decides.
 */
export function pickComments(threads: Thread[], opts: { cursor: string | null; floor: string; videoChannelId: string | null }): PickedPage {
  const cursorMs = opts.cursor ? Date.parse(opts.cursor) : null;
  const floorMs = Date.parse(opts.floor);
  const boundaryMs = cursorMs !== null && !Number.isNaN(cursorMs) ? Math.max(cursorMs, floorMs) : floorMs;
  const comments: PickedComment[] = [];
  let reachedCursor = false;
  let newest: string | null = null;

  const keep = (c: CommentData): boolean => {
    if (!c.publishedAt) return false;
    const t = Date.parse(c.publishedAt);
    if (Number.isNaN(t) || t < floorMs) return false;
    if (cursorMs !== null && t < cursorMs) return false;
    if (opts.videoChannelId && c.authorChannelId === opts.videoChannelId) return false;
    return true;
  };

  for (let i = 0; i < threads.length; i++) {
    const th = threads[i];
    const topMs = th.top.publishedAt ? Date.parse(th.top.publishedAt) : NaN;
    const judge = i > 0 || threads.length === 1;
    if (judge && !Number.isNaN(topMs) && topMs <= boundaryMs) reachedCursor = true;
    newest = newer(newest, th.top.publishedAt);
    if (keep(th.top)) comments.push({ comment: th.top, parentId: null });
    for (const r of th.replies) {
      newest = newer(newest, r.publishedAt);
      if (keep(r)) comments.push({ comment: r, parentId: th.top.id });
    }
  }
  return { comments, reachedCursor, newest };
}

/** The stored form of a comment. No author field, by rule. */
export function toRawItems(picked: PickedComment[], v: Pick<VideoRow, "video_id" | "title" | "channel_title" | "topics">): RawItem[] {
  const community = v.channel_title ? `YouTube · ${v.channel_title}` : `YouTube · ${v.title ?? v.video_id}`;
  return picked.map(({ comment, parentId }) => ({
    platform: "youtube",
    sourceKind: "auto",
    externalId: comment.id,
    // `lc=` highlights the comment. A reply's id from the API already has the
    // form PARENT.REPLY; older ids without the dot get the parent prepended.
    // Not in Google's docs, but it is what YouTube's own UI produces.
    url: `https://www.youtube.com/watch?v=${v.video_id}&lc=${parentId && !comment.id.includes(".") ? `${parentId}.${comment.id}` : comment.id}`,
    community,
    title: null,
    body: comment.text,
    postedAt: comment.publishedAt,
    meta: {
      video_id: v.video_id,
      video_title: v.title,
      like_count: comment.likeCount,
      topic: v.topics[0] ?? null,
      is_reply: parentId !== null,
    },
  }));
}

// ---------------------------------------------------------------------------
// Saving partial rows safely
// ---------------------------------------------------------------------------

/**
 * supabase-js sends one column list for a whole upsert batch (the union of
 * every row's keys) and fills a row's missing keys with null. A batch that
 * mixes {id, status} with {id, title, ...} would therefore null out columns,
 * or fail on NOT NULL ones. Grouping rows by their exact set of keys makes
 * every batch uniform, so each row only touches the columns it names.
 */
export function groupByShape<T extends object>(rows: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const shape = Object.keys(r)
      .filter((k) => (r as Record<string, unknown>)[k] !== undefined)
      .sort()
      .join(",");
    const clean = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as T;
    const g = groups.get(shape);
    if (g) g.push(clean);
    else groups.set(shape, [clean]);
  }
  return [...groups.values()];
}
