import { RETENTION_DAYS } from "../config";
import { env } from "../env";
import type { RawItem } from "../types";
import { CollectorConfigError, type Collector } from "./types";

// Verified against developers.google.com/youtube/v3 docs on 16 Sep 2026:
// search.list: 1 call from its own 100/day bucket; commentThreads.list: 1 unit of 10,000/day.
const API = "https://www.googleapis.com/youtube/v3";
const VIDEO_LOOKBACK_DAYS = 90;

interface SearchResponse {
  items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }>;
}

interface CommentThreadsResponse {
  items?: Array<{
    snippet?: {
      topLevelComment?: {
        id?: string;
        snippet?: { textOriginal?: string; publishedAt?: string; likeCount?: number };
      };
    };
  }>;
}

interface GoogleError {
  error?: { message?: string; errors?: Array<{ reason?: string }> };
}

async function readError(res: Response): Promise<{ reason: string | null; message: string }> {
  const body = (await res.json().catch(() => ({}))) as GoogleError;
  return {
    reason: body.error?.errors?.[0]?.reason ?? null,
    message: body.error?.message ?? `HTTP ${res.status}`,
  };
}

/**
 * Which topics this run searches. The cron runs every 2 hours, so the window
 * number advances every 2 hours and the slice moves along the list; with 9
 * topics and 4 per run every topic comes up at least once a day while the
 * daily total stays at 48 of the 100 free searches.
 */
export function rotateTopics(all: string[], perRun: number, now: Date): string[] {
  const topics = all.filter((t) => t.trim() !== "");
  const n = Math.max(0, Math.min(perRun, topics.length));
  if (n === 0) return [];
  if (n === topics.length) return topics;
  const window = Math.floor(now.getTime() / (2 * 3_600_000));
  const start = (window * n) % topics.length;
  return Array.from({ length: n }, (_, i) => topics[(start + i) % topics.length]);
}

/**
 * For each topic chosen for this run: one search.list call (recent, relevant videos),
 * then one commentThreads.list call per video. Keeps only top-level comments
 * from the last RETENTION_DAYS. Authors are never read or stored.
 */
export const collectYouTube: Collector = async ({ config, now }) => {
  const key = env("YOUTUBE_API_KEY");
  if (!key) {
    throw new CollectorConfigError(
      "YOUTUBE_API_KEY is not set. Create a key in Google Cloud console (APIs & Services → Credentials) with the YouTube Data API v3 enabled.",
    );
  }

  const topics = rotateTopics(config.youtube_topics, config.youtube_max_searches_per_run, now);
  const publishedAfter = new Date(now.getTime() - VIDEO_LOOKBACK_DAYS * 86_400_000).toISOString();
  const commentCutoff = now.getTime() - RETENTION_DAYS * 86_400_000;

  const items: RawItem[] = [];
  const seenVideos = new Set<string>();
  let searches = 0;
  let videos = 0;
  let commentsSeen = 0;
  let commentsDisabled = 0;

  for (const topic of topics) {
    const search = new URL(`${API}/search`);
    search.searchParams.set("part", "snippet");
    search.searchParams.set("q", topic);
    search.searchParams.set("type", "video");
    search.searchParams.set("order", "relevance");
    search.searchParams.set("publishedAfter", publishedAfter);
    search.searchParams.set("maxResults", String(Math.min(50, Math.max(1, config.youtube_videos_per_topic))));
    search.searchParams.set("relevanceLanguage", "en");
    search.searchParams.set("key", key);

    const sres = await fetch(search, { cache: "no-store" });
    if (!sres.ok) {
      const e = await readError(sres);
      if (e.reason === "quotaExceeded") throw new Error(`YouTube search quota exhausted for today: ${e.message}`);
      throw new Error(`YouTube search.list failed: ${e.message}`);
    }
    searches++;
    const sdata = (await sres.json()) as SearchResponse;

    for (const v of sdata.items ?? []) {
      const videoId = v.id?.videoId;
      if (!videoId || seenVideos.has(videoId)) continue;
      seenVideos.add(videoId);
      videos++;
      const videoTitle = v.snippet?.title ?? videoId;
      // The channel is the stable "community" shown on the card;
      // a video title would reset the allowance on every video.
      const channel = v.snippet?.channelTitle ?? null;

      const threads = new URL(`${API}/commentThreads`);
      threads.searchParams.set("part", "snippet");
      threads.searchParams.set("videoId", videoId);
      threads.searchParams.set("order", "time");
      threads.searchParams.set("textFormat", "plainText");
      threads.searchParams.set("maxResults", String(Math.min(100, Math.max(1, config.youtube_comments_per_video))));
      threads.searchParams.set("key", key);

      const cres = await fetch(threads, { cache: "no-store" });
      if (!cres.ok) {
        const e = await readError(cres);
        if (e.reason === "commentsDisabled") {
          commentsDisabled++;
          continue;
        }
        if (e.reason === "quotaExceeded") throw new Error(`YouTube quota exhausted for today: ${e.message}`);
        // A single broken video should not stop the whole run.
        continue;
      }
      const cdata = (await cres.json()) as CommentThreadsResponse;

      for (const t of cdata.items ?? []) {
        const top = t.snippet?.topLevelComment;
        const s = top?.snippet;
        if (!top?.id || !s?.textOriginal) continue;
        commentsSeen++;
        const posted = s.publishedAt ? Date.parse(s.publishedAt) : NaN;
        if (!Number.isNaN(posted) && posted < commentCutoff) continue;

        items.push({
          platform: "youtube",
          sourceKind: "auto",
          externalId: top.id,
          // `lc=` highlights the comment. Not in Google's docs, but it is what
          // YouTube's own UI produces and it has worked for years.
          url: `https://www.youtube.com/watch?v=${videoId}&lc=${top.id}`,
          community: channel ? `YouTube · ${channel}` : `YouTube · ${videoTitle}`,
          title: null,
          body: s.textOriginal,
          postedAt: s.publishedAt ?? null,
          meta: { video_id: videoId, video_title: videoTitle, like_count: s.likeCount ?? 0, topic },
        });
      }
    }
  }

  return {
    items,
    notes: {
      searches_used: searches,
      topics_searched: topics,
      videos_scanned: videos,
      comments_seen: commentsSeen,
      comments_recent: items.length,
      videos_with_comments_disabled: commentsDisabled,
    },
  };
};
