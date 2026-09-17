import { describe, expect, it } from "vitest";
import type { VideoRow } from "@/lib/types";
import type { Thread, VideoDetails } from "@/lib/youtube/api";
import { decideRead, groupByShape, nextCheckAt, pickComments, shouldRetire, toRawItems } from "@/lib/youtube/rules";

const now = new Date("2026-09-17T15:00:00Z");

function row(over: Partial<VideoRow> = {}): VideoRow {
  return {
    video_id: "v1",
    channel_id: "UCabc",
    channel_title: "Dr Diet",
    title: "Thyroid diet",
    published_at: "2026-06-01T00:00:00Z",
    duration_seconds: 600,
    is_short: false,
    is_live: false,
    topics: ["thyroid diet"],
    found_via: "sweep",
    comment_count: 100,
    count_checked_at: null,
    last_change_at: "2026-09-10T00:00:00Z",
    last_read_at: "2026-09-16T00:00:00Z",
    newest_comment_at: "2026-09-15T00:00:00Z",
    pending_newest_at: null,
    read_resume_token: null,
    read_pages_total: 0,
    next_check_at: "2026-09-17T00:00:00Z",
    status: "active",
    kept_items: 0,
    first_seen_at: "2026-09-01T00:00:00Z",
    last_seen_at: "2026-09-16T00:00:00Z",
    ...over,
  };
}

function fresh(over: Partial<VideoDetails> = {}): VideoDetails {
  return { videoId: "v1", channelId: "UCabc", channelTitle: "Dr Diet", title: "Thyroid diet", publishedAt: "2026-06-01T00:00:00Z", commentCount: 100, durationSeconds: 600, live: false, ...over };
}

describe("decideRead", () => {
  it("reads when the comment count moved", () => {
    expect(decideRead({ row: row(), fresh: fresh({ commentCount: 101 }), changed: true }, now)).toBe("count_changed");
  });
  it("skips a quiet video that was read recently", () => {
    expect(decideRead({ row: row(), fresh: fresh(), changed: false }, now)).toBeNull();
  });
  it("reads a fresh video every run regardless of the count", () => {
    expect(decideRead({ row: row({ published_at: "2026-09-15T00:00:00Z" }), fresh: fresh({ publishedAt: "2026-09-15T00:00:00Z" }), changed: false }, now)).toBe("fresh");
  });
  it("re-reads any video not read for 7 days", () => {
    expect(decideRead({ row: row({ last_read_at: "2026-09-01T00:00:00Z" }), fresh: fresh(), changed: false }, now)).toBe("reread");
  });
  it("always reads a video never read before", () => {
    expect(decideRead({ row: row({ last_read_at: null, newest_comment_at: null }), fresh: fresh(), changed: false }, now)).toBe("never_read");
  });
  it("continues an unfinished read first", () => {
    expect(decideRead({ row: row({ read_resume_token: "tok" }), fresh: fresh(), changed: false }, now)).toBe("resume");
  });
  it("a Short is read weekly only, even when its count moved", () => {
    expect(decideRead({ row: row(), fresh: fresh({ durationSeconds: 45, commentCount: 500 }), changed: true }, now)).toBeNull();
    expect(decideRead({ row: row({ last_read_at: "2026-09-01T00:00:00Z" }), fresh: fresh({ durationSeconds: 45 }), changed: true }, now)).toBe("reread");
  });
  it("skips a live broadcast", () => {
    expect(decideRead({ row: row(), fresh: fresh({ live: true }), changed: true }, now)).toBeNull();
  });
});

describe("nextCheckAt", () => {
  it("2 hours when the count moved or the video is fresh", () => {
    expect(nextCheckAt(row(), true, now).toISOString()).toBe("2026-09-17T17:00:00.000Z");
    expect(nextCheckAt(row({ published_at: "2026-09-16T00:00:00Z" }), false, now).toISOString()).toBe("2026-09-17T17:00:00.000Z");
  });
  it("24 hours for an old video quiet for less than 60 days", () => {
    expect(nextCheckAt(row(), false, now).toISOString()).toBe("2026-09-18T15:00:00.000Z");
  });
  it("7 days for a video quiet for 60 days or more", () => {
    expect(nextCheckAt(row({ last_change_at: "2026-06-01T00:00:00Z" }), false, now).toISOString()).toBe("2026-09-24T15:00:00.000Z");
  });
});

describe("shouldRetire", () => {
  it("retires only an old video with no change for 180 days", () => {
    expect(shouldRetire(row({ published_at: "2025-06-01T00:00:00Z", last_change_at: "2026-01-01T00:00:00Z" }), now)).toBe(true);
    expect(shouldRetire(row({ published_at: "2026-06-01T00:00:00Z", last_change_at: "2026-01-01T00:00:00Z" }), now)).toBe(false);
    expect(shouldRetire(row({ published_at: "2025-06-01T00:00:00Z", last_change_at: "2026-09-01T00:00:00Z" }), now)).toBe(false);
  });
});

function thread(id: string, at: string, replies: Array<[string, string, string | null]> = [], author: string | null = "UCviewer"): Thread {
  return {
    top: { id, text: `comment ${id} long enough`, publishedAt: at, likeCount: 1, authorChannelId: author },
    replies: replies.map(([rid, rat, rauthor]) => ({ id: rid, text: `reply ${rid}`, publishedAt: rat, likeCount: 0, authorChannelId: rauthor })),
  };
}

describe("pickComments", () => {
  const floor = "2026-01-01T00:00:00Z";

  it("keeps everything on a first read (no cursor) and reports the newest time", () => {
    const p = pickComments([thread("a", "2026-09-17T10:00:00Z"), thread("b", "2026-09-16T10:00:00Z")], { cursor: null, floor, videoChannelId: "UCabc" });
    expect(p.comments.map((c) => c.comment.id)).toEqual(["a", "b"]);
    expect(p.reachedCursor).toBe(false);
    expect(p.newest).toBe("2026-09-17T10:00:00Z");
  });

  it("stops at the cursor, keeping a comment that shares the cursor second (the database drops the one we have)", () => {
    const p = pickComments(
      [thread("a", "2026-09-17T10:00:00Z"), thread("b", "2026-09-15T00:00:00Z"), thread("c", "2026-09-14T10:00:00Z")],
      { cursor: "2026-09-15T00:00:00Z", floor, videoChannelId: "UCabc" },
    );
    expect(p.comments.map((c) => c.comment.id)).toEqual(["a", "b"]);
    expect(p.reachedCursor).toBe(true);
  });

  it("does not stop on an old pinned comment sitting at the top of the page", () => {
    const p = pickComments(
      [thread("pinned", "2026-03-01T00:00:00Z"), thread("n1", "2026-09-17T10:00:00Z"), thread("n2", "2026-09-17T09:00:00Z")],
      { cursor: "2026-09-15T00:00:00Z", floor, videoChannelId: "UCabc" },
    );
    expect(p.reachedCursor).toBe(false);
    expect(p.comments.map((c) => c.comment.id)).toEqual(["n1", "n2"]);
  });

  it("a page with a single old thread does stop", () => {
    const p = pickComments([thread("only", "2026-09-01T00:00:00Z")], { cursor: "2026-09-15T00:00:00Z", floor, videoChannelId: "UCabc" });
    expect(p.reachedCursor).toBe(true);
  });

  it("a first read of an old video stops once it reaches comments older than the floor", () => {
    const p = pickComments(
      [thread("x", "2026-01-03T00:00:00Z"), thread("y", "2025-12-20T00:00:00Z"), thread("z", "2025-11-01T00:00:00Z")],
      { cursor: null, floor, videoChannelId: "UCabc" },
    );
    expect(p.reachedCursor).toBe(true);
    expect(p.comments.map((c) => c.comment.id)).toEqual(["x"]);
  });

  it("keeps a new reply under an old thread on the same page, with its parent id", () => {
    const p = pickComments([thread("old", "2026-09-10T00:00:00Z", [["r1", "2026-09-17T09:00:00Z", "UCviewer2"]])], { cursor: "2026-09-15T00:00:00Z", floor, videoChannelId: "UCabc" });
    expect(p.comments).toHaveLength(1);
    expect(p.comments[0].comment.id).toBe("r1");
    expect(p.comments[0].parentId).toBe("old");
    expect(p.newest).toBe("2026-09-17T09:00:00Z");
  });

  it("drops the creator's own comments and anything before the floor", () => {
    const p = pickComments(
      [thread("creator", "2026-09-17T10:00:00Z", [], "UCabc"), thread("ancient", "2025-12-31T23:00:00Z")],
      { cursor: null, floor, videoChannelId: "UCabc" },
    );
    expect(p.comments).toHaveLength(0);
  });
});

describe("toRawItems", () => {
  it("builds the comment link, PARENT.REPLY for a reply, and never carries an author", () => {
    const items = toRawItems(
      [
        { comment: { id: "c1", text: "Can I eat rice on metformin?", publishedAt: "2026-09-17T10:00:00Z", likeCount: 3, authorChannelId: "UCviewer" }, parentId: null },
        { comment: { id: "r1", text: "same question", publishedAt: "2026-09-17T11:00:00Z", likeCount: 0, authorChannelId: "UCviewer2" }, parentId: "c1" },
        { comment: { id: "c1.r2", text: "API-style reply id", publishedAt: "2026-09-17T12:00:00Z", likeCount: 0, authorChannelId: "UCviewer3" }, parentId: "c1" },
      ],
      row(),
    );
    expect(items[0].url).toBe("https://www.youtube.com/watch?v=v1&lc=c1");
    expect(items[1].url).toBe("https://www.youtube.com/watch?v=v1&lc=c1.r1");
    expect(items[2].url).toBe("https://www.youtube.com/watch?v=v1&lc=c1.r2");
    expect(items[0].community).toBe("YouTube · Dr Diet");
    expect(items[0].meta).toEqual({ video_id: "v1", video_title: "Thyroid diet", like_count: 3, topic: "thyroid diet", is_reply: false });
    expect(JSON.stringify(items)).not.toContain("UCviewer");
  });
});

describe("groupByShape", () => {
  it("never mixes rows with different columns in one batch, so no column is nulled", () => {
    const groups = groupByShape<Record<string, unknown>>([
      { video_id: "a", status: "gone", count_checked_at: "t" },
      { video_id: "b", title: "T", comment_count: 3, next_check_at: "t" },
      { count_checked_at: "t", status: "gone", video_id: "c" },
      { video_id: "d", title: "T", comment_count: 5, next_check_at: undefined },
    ]);
    for (const g of groups) expect(new Set(g.map((r) => Object.keys(r).sort().join(","))).size).toBe(1);
    expect(groups).toHaveLength(3);
    expect(groups.flat().find((r) => r.video_id === "d")).toEqual({ video_id: "d", title: "T", comment_count: 5 });
  });
});
