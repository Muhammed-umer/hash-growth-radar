import { describe, expect, it } from "vitest";
import { createYouTubeClient, isBadPageToken, parseIsoDuration, QuotaExhausted, YouTubeApiError } from "@/lib/youtube/api";
import { memoryLedger, QuotaBudgetReached } from "@/lib/youtube/quota";

function fakeFetch(handler: (url: URL) => { status: number; body: unknown }) {
  const calls: URL[] = [];
  const fn = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    calls.push(url);
    const r = handler(url);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fn, calls };
}

describe("parseIsoDuration", () => {
  it("reads PT#H#M#S", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});

describe("createYouTubeClient", () => {
  it("sends the documented parameters and counts a search in the search pot", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const f = fakeFetch(() => ({ status: 200, body: { items: [{ id: { videoId: "v1" }, snippet: { title: "T", channelId: "UC1", channelTitle: "C", publishedAt: "2026-09-01T00:00:00Z" } }], nextPageToken: "p2" } }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn });
    const page = await c.searchList({ q: "thyroid diet", order: "date", publishedAfter: "2026-09-01T00:00:00Z", relevanceLanguage: "en" });
    const u = f.calls[0];
    expect(u.pathname).toBe("/youtube/v3/search");
    expect(u.searchParams.get("type")).toBe("video");
    expect(u.searchParams.get("maxResults")).toBe("50");
    expect(u.searchParams.get("order")).toBe("date");
    expect(u.searchParams.get("publishedAfter")).toBe("2026-09-01T00:00:00Z");
    expect(u.searchParams.get("key")).toBe("k");
    expect(page.items[0]).toEqual({ videoId: "v1", title: "T", channelId: "UC1", channelTitle: "C", publishedAt: "2026-09-01T00:00:00Z" });
    expect(page.nextPageToken).toBe("p2");
    expect(await ledger.today()).toEqual({ searches: 1, units: 0 });
  });

  it("counts comment reads in the unit pot and parses threads with replies, keeping authorChannelId only in memory", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const f = fakeFetch(() => ({
      status: 200,
      body: {
        items: [
          {
            snippet: { topLevelComment: { id: "c1", snippet: { textOriginal: "hi there", publishedAt: "2026-09-17T00:00:00Z", likeCount: "2", authorChannelId: { value: "UCx" } } } },
            replies: { comments: [{ id: "c1.r1", snippet: { textOriginal: "reply", publishedAt: "2026-09-17T01:00:00Z" } }] },
          },
        ],
      },
    }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn });
    const page = await c.commentThreadsList("v1");
    expect(f.calls[0].searchParams.get("part")).toBe("snippet,replies");
    expect(f.calls[0].searchParams.get("order")).toBe("time");
    expect(f.calls[0].searchParams.get("maxResults")).toBe("100");
    expect(page.items[0].top).toEqual({ id: "c1", text: "hi there", publishedAt: "2026-09-17T00:00:00Z", likeCount: 2, authorChannelId: "UCx" });
    expect(page.items[0].replies[0].id).toBe("c1.r1");
    expect(await ledger.today()).toEqual({ searches: 0, units: 1 });
  });

  it("maps Google's errors: quotaExceeded, commentsDisabled, invalidPageToken", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const reasons = ["quotaExceeded", "commentsDisabled", "invalidPageToken"];
    let i = 0;
    const f = fakeFetch(() => ({ status: 403, body: { error: { message: "m", errors: [{ reason: reasons[i++] }] } } }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn });
    await expect(c.commentThreadsList("v1")).rejects.toBeInstanceOf(QuotaExhausted);
    await expect(c.commentThreadsList("v1")).rejects.toMatchObject({ reason: "commentsDisabled" });
    const e = await c.commentThreadsList("v1").catch((x) => x);
    expect(e).toBeInstanceOf(YouTubeApiError);
    expect(e.reason).toBe("invalidPageToken");
  });

  it("stops before Google does: the ledger throws before the request is sent", async () => {
    const ledger = memoryLedger({ searches: 1, units: 9000 });
    const f = fakeFetch(() => ({ status: 200, body: { items: [] } }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn });
    await c.searchList({ q: "x", order: "relevance" });
    await expect(c.searchList({ q: "x", order: "relevance" })).rejects.toBeInstanceOf(QuotaBudgetReached);
    expect(f.calls).toHaveLength(1);
  });

  it("videos.list sends up to 50 ids in one unit and reads count, duration and live state", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const f = fakeFetch(() => ({
      status: 200,
      body: { items: [{ id: "v1", snippet: { channelId: "UC1", title: "T", publishedAt: "2026-09-01T00:00:00Z", liveBroadcastContent: "none" }, statistics: { commentCount: "42" }, contentDetails: { duration: "PT45S" } }] },
    }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn });
    const ids = Array.from({ length: 50 }, (_, i) => `v${i}`);
    const out = await c.videosList(ids);
    expect(f.calls[0].searchParams.get("id")!.split(",")).toHaveLength(50);
    expect(out[0]).toMatchObject({ videoId: "v1", commentCount: 42, durationSeconds: 45, live: false });
    expect(await ledger.today()).toEqual({ searches: 0, units: 1 });
  });
});

describe("resilience", () => {
  const noSleep = async () => {};

  it("retries a 503 twice, counts every attempt, then succeeds", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    let n = 0;
    const f = fakeFetch(() => (++n < 3 ? { status: 503, body: { error: { message: "backend" } } } : { status: 200, body: { items: [] } }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn, sleep: noSleep });
    await expect(c.playlistItemsList("UU1")).resolves.toEqual({ items: [], nextPageToken: null });
    expect(f.calls).toHaveLength(3);
    expect(await ledger.today()).toEqual({ searches: 0, units: 3 });
  });

  it("gives up after the retries with a clear error", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const f = fakeFetch(() => ({ status: 500, body: {} }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn, sleep: noSleep });
    await expect(c.videosList(["v1"])).rejects.toMatchObject({ status: 500 });
    expect(f.calls).toHaveLength(3);
  });

  it("turns a network failure into a YouTubeApiError after retries", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const fn = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: fn, sleep: noSleep });
    await expect(c.videosList(["v1"])).rejects.toMatchObject({ reason: "network" });
  });

  it("does not retry a 4xx", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const f = fakeFetch(() => ({ status: 400, body: { error: { errors: [{ reason: "badRequest" }] } } }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn, sleep: noSleep });
    await expect(c.commentThreadsList("v1", "tok")).rejects.toBeInstanceOf(YouTubeApiError);
    expect(f.calls).toHaveLength(1);
  });

  it("recognises a rejected page token only when a token was sent", () => {
    const e400 = new YouTubeApiError("badRequest", 400, "x");
    expect(isBadPageToken(e400, true)).toBe(true);
    expect(isBadPageToken(e400, false)).toBe(false);
    expect(isBadPageToken(new YouTubeApiError("invalidPageToken", 400, "x"), false)).toBe(true);
    expect(isBadPageToken(new YouTubeApiError("forbidden", 403, "x"), true)).toBe(false);
  });

  it("skips private and deleted placeholders in an uploads playlist", async () => {
    const ledger = memoryLedger({ searches: 95, units: 9000 });
    const f = fakeFetch(() => ({
      status: 200,
      body: {
        items: [
          { snippet: { title: "Private video" }, contentDetails: { videoId: "p1" } },
          { snippet: { title: "Deleted video" }, contentDetails: { videoId: "d1" } },
          { snippet: { title: "Real", videoOwnerChannelId: "UC1" }, contentDetails: { videoId: "v1", videoPublishedAt: "2026-09-01T00:00:00Z" } },
        ],
      },
    }));
    const c = createYouTubeClient({ apiKey: "k", ledger, fetchFn: f.fn, sleep: noSleep });
    const page = await c.playlistItemsList("UU1");
    expect(page.items.map((v) => v.videoId)).toEqual(["v1"]);
  });
});
