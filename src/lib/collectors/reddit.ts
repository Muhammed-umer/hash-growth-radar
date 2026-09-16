import { RETENTION_DAYS } from "../config";
import { env } from "../env";
import type { RawItem } from "../types";
import { CollectorConfigError, type Collector } from "./types";

/**
 * Official Reddit Data API, app-only OAuth (client_credentials). Only runs when
 * Reddit has approved access (Responsible Builder Policy, June 2026) AND the
 * credentials are set AND "Reddit API enabled" is on in Settings. Until then,
 * Reddit posts are pasted in by hand on the Reddit page.
 *
 * Reads public posts only. Authors are never read or stored.
 */
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";

interface Listing {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        permalink?: string;
        subreddit?: string;
        created_utc?: number;
        over_18?: boolean;
        num_comments?: number;
        score?: number;
      };
    }>;
  };
}

async function getToken(id: string, secret: string, ua: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Reddit token request failed (${res.status}). Has Reddit approved this app?`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Reddit token response had no access_token");
  return data.access_token;
}

export const collectReddit: Collector = async ({ settings, now }) => {
  if (!settings.reddit_api_enabled) {
    throw new CollectorConfigError("Reddit API is switched off in Settings. Paste posts by hand until Reddit approves access.");
  }
  const id = env("REDDIT_CLIENT_ID");
  const secret = env("REDDIT_CLIENT_SECRET");
  if (!id || !secret) {
    throw new CollectorConfigError("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are not set.");
  }
  const ua = env("REDDIT_USER_AGENT") ?? "web:hash-growth-radar:v1 (internal founder tool)";
  const token = await getToken(id, secret, ua);
  const headers = { Authorization: `Bearer ${token}`, "User-Agent": ua };
  const cutoff = (now.getTime() - RETENTION_DAYS * 86_400_000) / 1000;

  const items: RawItem[] = [];
  const seen = new Set<string>();
  let requests = 0;

  const absorb = (listing: Listing) => {
    for (const c of listing.data?.children ?? []) {
      const d = c.data;
      if (!d?.id || seen.has(d.id) || d.over_18) continue;
      if (d.created_utc && d.created_utc < cutoff) continue;
      seen.add(d.id);
      items.push({
        platform: "reddit",
        sourceKind: "auto",
        externalId: d.id,
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
        community: d.subreddit ? `r/${d.subreddit}` : null,
        title: d.title ?? null,
        body: d.selftext ?? null,
        postedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
        meta: { num_comments: d.num_comments ?? null, score: d.score ?? null },
      });
    }
  };

  for (const sub of settings.reddit_subreddits) {
    const res = await fetch(`${API}/r/${encodeURIComponent(sub)}/new?limit=50&raw_json=1`, { headers, cache: "no-store" });
    requests++;
    if (!res.ok) continue; // private / banned / renamed subreddit: skip, keep going
    absorb((await res.json()) as Listing);
  }

  for (const q of settings.reddit_queries) {
    const u = new URL(`${API}/search`);
    u.searchParams.set("q", q);
    u.searchParams.set("sort", "new");
    u.searchParams.set("t", "week");
    u.searchParams.set("limit", "50");
    u.searchParams.set("raw_json", "1");
    const res = await fetch(u, { headers, cache: "no-store" });
    requests++;
    if (!res.ok) continue;
    absorb((await res.json()) as Listing);
  }

  return { items, notes: { requests, posts: items.length } };
};
