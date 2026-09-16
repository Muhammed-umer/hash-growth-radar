import { describe, expect, it } from "vitest";
import { manualPost } from "@/lib/collectors/manual";

describe("manualPost", () => {
  it("uses the same id as the automatic Reddit collector and derives the community", () => {
    const raw = manualPost({
      platform: "reddit",
      url: "https://www.reddit.com/r/type2diabetes/comments/1abc9z/metformin_and_rice/?utm_source=share",
      community: null,
      title: " Metformin and rice ",
      body: "Doctor put me on metformin last week. Is it fine to keep eating rice?",
      postedAt: "2026-09-15T10:00:00.000Z",
    });
    expect(raw.platform).toBe("reddit");
    expect(raw.sourceKind).toBe("manual");
    expect(raw.externalId).toBe("1abc9z");
    expect(raw.community).toBe("r/type2diabetes");
    expect(raw.title).toBe("Metformin and rice");
    expect(raw.url).toBe("https://www.reddit.com/r/type2diabetes/comments/1abc9z/metformin_and_rice/?utm_source=share");
  });

  it("keeps a community typed by hand and turns blank fields into null", () => {
    const raw = manualPost({
      platform: "reddit",
      url: "   ",
      community: "r/PCOS",
      title: "",
      body: "  Any app that tracks food with letrozole?  ",
      postedAt: null,
    });
    expect(raw.url).toBeNull();
    expect(raw.title).toBeNull();
    expect(raw.community).toBe("r/PCOS");
    expect(raw.body).toBe("Any app that tracks food with letrozole?");
    expect(raw.externalId.startsWith("text:")).toBe(true);
  });

  it("falls back to a url id for non-Reddit links", () => {
    const raw = manualPost({
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=abc&lc=xyz",
      community: null,
      title: null,
      body: "Can I eat this on metformin?",
      postedAt: null,
    });
    expect(raw.externalId.startsWith("url:")).toBe(true);
  });
});
