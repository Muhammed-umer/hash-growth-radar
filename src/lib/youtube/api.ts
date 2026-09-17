/**
 * The five YouTube Data API v3 calls the watch list uses, typed, each counted
 * in the ledger before it is sent. Parameters verified against Google's
 * reference pages on 17 Sep 2026 (see docs/coverage-plan.html section 2).
 * No server-only import so tests can drive it with a fake fetch.
 */
import { Ledger } from "./quota";

const API = "https://www.googleapis.com/youtube/v3";

export type SearchOrder = "date" | "relevance" | "viewCount";

export interface SearchVideo {
  videoId: string;
  title: string | null;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
}

export interface VideoDetails {
  videoId: string;
  channelId: string | null;
  channelTitle: string | null;
  title: string | null;
  publishedAt: string | null;
  /** null when YouTube omits it (comments hidden). */
  commentCount: number | null;
  durationSeconds: number | null;
  /** true for a live or upcoming broadcast. */
  live: boolean;
}

export interface ChannelDetails {
  channelId: string;
  title: string | null;
  uploadsPlaylistId: string | null;
}

export interface PlaylistVideo {
  videoId: string;
  title: string | null;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
}

export interface CommentData {
  id: string;
  text: string;
  publishedAt: string | null;
  likeCount: number;
  /** Compared in memory with the video's channel, never stored. */
  authorChannelId: string | null;
}

export interface Thread {
  top: CommentData;
  replies: CommentData[];
}

export interface Page<T> {
  items: T[];
  nextPageToken: string | null;
}

export interface SearchParams {
  q: string;
  order: SearchOrder;
  publishedAfter?: string;
  publishedBefore?: string;
  relevanceLanguage?: string;
  pageToken?: string;
}

export interface YouTubeClient {
  /** 1 search per page. */
  searchList(p: SearchParams): Promise<Page<SearchVideo>>;
  /** 1 unit for up to 50 ids. */
  videosList(ids: string[]): Promise<VideoDetails[]>;
  /** 1 unit for up to 50 ids. */
  channelsList(ids: string[]): Promise<ChannelDetails[]>;
  /** 1 unit per page of 50. */
  playlistItemsList(playlistId: string, pageToken?: string): Promise<Page<PlaylistVideo>>;
  /** 1 unit per page of 100 threads, newest first, first replies included. */
  commentThreadsList(videoId: string, pageToken?: string): Promise<Page<Thread>>;
}

/** Google answered with an error. `reason` is Google's code (commentsDisabled, videoNotFound, invalidPageToken, ...). */
export class YouTubeApiError extends Error {
  constructor(
    public readonly reason: string | null,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

/** Google said quotaExceeded: a pot is empty until the Pacific-midnight reset. */
export class QuotaExhausted extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExhausted";
  }
}

interface GoogleError {
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

/** "PT1H2M3S" -> seconds. */
export function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, mi, s] = m;
  return (Number(d ?? 0) * 24 + Number(h ?? 0)) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0);
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** True when Google rejected a page token we sent (tokens are opaque and can expire). */
export function isBadPageToken(e: unknown, tokenSent: boolean): boolean {
  if (!(e instanceof YouTubeApiError)) return false;
  return e.reason === "invalidPageToken" || (tokenSent && e.status === 400);
}

/** Retries after a network error or a 5xx answer, each attempt counted in the ledger. */
const RETRIES = 2;
const REQUEST_TIMEOUT_MS = 20_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createYouTubeClient(opts: {
  apiKey: string;
  ledger: Ledger;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): YouTubeClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function call(path: string, params: Record<string, string | undefined>, cost: "searches" | "units"): Promise<any> {
    const url = new URL(`${API}/${path}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, v);
    url.searchParams.set("key", opts.apiKey);

    for (let attempt = 0; ; attempt++) {
      // Counted before every attempt: a failed request can still cost quota.
      await opts.ledger.spend(cost, 1);
      let res: Response;
      try {
        res = await fetchFn(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch (e) {
        if (attempt < RETRIES) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        const msg = e instanceof Error ? e.message : String(e);
        throw new YouTubeApiError("network", 0, `YouTube ${path} request failed: ${msg}`);
      }
      if (res.ok) return res.json();
      const body = (await res.json().catch(() => ({}))) as GoogleError;
      const reason = body.error?.errors?.[0]?.reason ?? null;
      const message = body.error?.message ?? `HTTP ${res.status}`;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        throw new QuotaExhausted(`YouTube quota exhausted for today: ${message}`);
      }
      if (res.status >= 500 && attempt < RETRIES) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new YouTubeApiError(reason, res.status, `YouTube ${path} failed: ${message}`);
    }
  }

  return {
    async searchList(p) {
      const data = await call(
        "search",
        {
          part: "snippet",
          type: "video",
          q: p.q,
          order: p.order,
          maxResults: "50",
          publishedAfter: p.publishedAfter,
          publishedBefore: p.publishedBefore,
          relevanceLanguage: p.relevanceLanguage,
          pageToken: p.pageToken,
        },
        "searches",
      );
      const items: SearchVideo[] = [];
      for (const it of data.items ?? []) {
        const id = it.id?.videoId;
        if (!id) continue;
        items.push({
          videoId: id,
          title: it.snippet?.title ?? null,
          channelId: it.snippet?.channelId ?? null,
          channelTitle: it.snippet?.channelTitle ?? null,
          publishedAt: it.snippet?.publishedAt ?? null,
        });
      }
      return { items, nextPageToken: data.nextPageToken ?? null };
    },

    async videosList(ids) {
      if (ids.length === 0) return [];
      const data = await call(
        "videos",
        { part: "snippet,statistics,contentDetails", id: ids.slice(0, 50).join(",") }, // maxResults is not supported with id
        "units",
      );
      const out: VideoDetails[] = [];
      for (const it of data.items ?? []) {
        if (!it.id) continue;
        const duration = parseIsoDuration(it.contentDetails?.duration);
        out.push({
          videoId: it.id,
          channelId: it.snippet?.channelId ?? null,
          channelTitle: it.snippet?.channelTitle ?? null,
          title: it.snippet?.title ?? null,
          publishedAt: it.snippet?.publishedAt ?? null,
          commentCount: num(it.statistics?.commentCount),
          durationSeconds: duration,
          live: (it.snippet?.liveBroadcastContent ?? "none") !== "none",
        });
      }
      return out;
    },

    async channelsList(ids) {
      if (ids.length === 0) return [];
      const data = await call("channels", { part: "snippet,contentDetails", id: ids.slice(0, 50).join(",") }, "units");
      const out: ChannelDetails[] = [];
      for (const it of data.items ?? []) {
        if (!it.id) continue;
        out.push({
          channelId: it.id,
          title: it.snippet?.title ?? null,
          uploadsPlaylistId: it.contentDetails?.relatedPlaylists?.uploads ?? null,
        });
      }
      return out;
    },

    async playlistItemsList(playlistId, pageToken) {
      const data = await call(
        "playlistItems",
        { part: "snippet,contentDetails", playlistId, maxResults: "50", pageToken },
        "units",
      );
      const items: PlaylistVideo[] = [];
      for (const it of data.items ?? []) {
        const id = it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId;
        if (!id) continue;
        // Private and deleted uploads stay in the playlist as placeholders with
        // no publish date; they have no comments we can read.
        const title = it.snippet?.title;
        if (!it.contentDetails?.videoPublishedAt && (title === "Private video" || title === "Deleted video")) continue;
        items.push({
          videoId: id,
          title: it.snippet?.title ?? null,
          channelId: it.snippet?.videoOwnerChannelId ?? it.snippet?.channelId ?? null,
          channelTitle: it.snippet?.videoOwnerChannelTitle ?? it.snippet?.channelTitle ?? null,
          publishedAt: it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt ?? null,
        });
      }
      return { items, nextPageToken: data.nextPageToken ?? null };
    },

    async commentThreadsList(videoId, pageToken) {
      const data = await call(
        "commentThreads",
        { part: "snippet,replies", videoId, order: "time", textFormat: "plainText", maxResults: "100", pageToken },
        "units",
      );
      const toComment = (c: any): CommentData | null => {
        const s = c?.snippet;
        if (!c?.id || !s?.textOriginal) return null;
        return {
          id: c.id,
          text: String(s.textOriginal),
          publishedAt: s.publishedAt ?? null,
          likeCount: num(s.likeCount) ?? 0,
          authorChannelId: s.authorChannelId?.value ?? null,
        };
      };
      const items: Thread[] = [];
      for (const t of data.items ?? []) {
        const top = toComment(t.snippet?.topLevelComment);
        if (!top) continue;
        const replies: CommentData[] = [];
        for (const r of t.replies?.comments ?? []) {
          const c = toComment(r);
          if (c) replies.push(c);
        }
        items.push({ top, replies });
      }
      return { items, nextPageToken: data.nextPageToken ?? null };
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
