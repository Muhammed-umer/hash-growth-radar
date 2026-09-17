import { describe, expect, it } from "vitest";
import { buildSweepUnits, newSinceAfter, relevanceDue, splitWindow, sweepPageOutcome } from "@/lib/youtube/rules";

const floor = new Date("2026-01-01T00:00:00Z");
const now = new Date("2026-09-17T15:00:00Z");

describe("buildSweepUnits", () => {
  const units = buildSweepUnits(["thyroid diet", "PCOS diet plan"], floor, now);

  it("makes one unit per phrase, month and order: 9 months x 2 phrases x 2 orders", () => {
    expect(units).toHaveLength(9 * 2 * 2);
  });

  it("walks backwards: the current month first, January last, viewCount before date", () => {
    expect(units[0]).toEqual({ phrase: "thyroid diet", published_after: "2026-09-01T00:00:00Z", published_before: "2026-09-17T15:00:00Z", order_by: "viewCount" });
    expect(units[1].order_by).toBe("date");
    expect(units[2].phrase).toBe("PCOS diet plan");
    expect(units[4].published_after).toBe("2026-08-01T00:00:00Z");
    expect(units[4].published_before).toBe("2026-09-01T00:00:00Z");
    const last = units[units.length - 1];
    expect(last).toEqual({ phrase: "PCOS diet plan", published_after: "2026-01-01T00:00:00Z", published_before: "2026-02-01T00:00:00Z", order_by: "date" });
  });

  it("windows touch with no gap and no overlap", () => {
    const thyroidView = units.filter((u) => u.phrase === "thyroid diet" && u.order_by === "viewCount");
    for (let i = 0; i + 1 < thyroidView.length; i++) {
      expect(thyroidView[i].published_after).toBe(thyroidView[i + 1].published_before);
    }
  });

  it("the current month ends exactly at the sweep start (the discover watermark)", () => {
    expect(units[0].published_before).toBe("2026-09-17T15:00:00Z");
  });

  it("a floor in the middle of a month starts that month at the floor", () => {
    const u = buildSweepUnits(["x"], new Date("2026-08-15T00:00:00Z"), now);
    expect(u[u.length - 1].published_after).toBe("2026-08-15T00:00:00Z");
    expect(u).toHaveLength(2 * 2);
  });
});

describe("splitWindow", () => {
  it("splits a capped window in two, later half first", () => {
    const [a, b] = splitWindow({ phrase: "x", published_after: "2026-08-01T00:00:00Z", published_before: "2026-09-01T00:00:00Z", order_by: "date" })!;
    expect(a.published_after).toBe("2026-08-16T12:00:00Z");
    expect(a.published_before).toBe("2026-09-01T00:00:00Z");
    expect(b.published_after).toBe("2026-08-01T00:00:00Z");
    expect(b.published_before).toBe("2026-08-16T12:00:00Z");
  });

  it("refuses to split below the minimum window", () => {
    expect(splitWindow({ phrase: "x", published_after: "2026-08-01T00:00:00Z", published_before: "2026-08-02T12:00:00Z", order_by: "date" })).toBeNull();
  });
});

describe("discover timing", () => {
  it("first run looks back 30 days; later runs start 1 hour before the watermark", () => {
    expect(newSinceAfter(null, now).toISOString()).toBe("2026-08-18T15:00:00.000Z");
    expect(newSinceAfter("2026-09-17T09:00:00Z", now).toISOString()).toBe("2026-09-17T08:00:00.000Z");
  });

  it("relevance search is due once a day", () => {
    expect(relevanceDue(null, now)).toBe(true);
    expect(relevanceDue("2026-09-17T03:00:00Z", now)).toBe(false);
    expect(relevanceDue("2026-09-16T10:00:00Z", now)).toBe(true);
  });
});

describe("sweepPageOutcome", () => {
  it("keeps paging while there is a next page before the cap", () => {
    expect(sweepPageOutcome({ pagesDone: 3, pageItems: 50, videosFound: 150, hasNextPage: true }, 10)).toBe("continue");
  });

  it("a month that runs out of pages before the cap is done, even if its last page was full", () => {
    expect(sweepPageOutcome({ pagesDone: 4, pageItems: 50, videosFound: 200, hasNextPage: false }, 10)).toBe("done");
  });

  it("splits at the cap when page 10 still has a next page", () => {
    expect(sweepPageOutcome({ pagesDone: 10, pageItems: 50, videosFound: 500, hasNextPage: true }, 10)).toBe("split");
  });

  it("splits at the cap when the token vanished but page 10 came back full", () => {
    expect(sweepPageOutcome({ pagesDone: 10, pageItems: 50, videosFound: 500, hasNextPage: false }, 10)).toBe("split");
  });

  it("splits at the cap when pages came back a little short but the window is nearly full", () => {
    expect(sweepPageOutcome({ pagesDone: 10, pageItems: 41, videosFound: 452, hasNextPage: false }, 10)).toBe("split");
  });

  it("does not split when the month genuinely ended on page 10 with a thin last page", () => {
    expect(sweepPageOutcome({ pagesDone: 10, pageItems: 7, videosFound: 367, hasNextPage: false }, 10)).toBe("done");
  });
});
