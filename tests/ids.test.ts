import { describe, expect, it } from "vitest";
import { manualExternalId, normalizeUrl, redditIdFromUrl, subredditFromUrl } from "@/lib/pipeline/ids";

describe("normalizeUrl", () => {
  it("strips www, query, fragment and trailing slash", () => {
    expect(normalizeUrl("https://www.reddit.com/r/diabetes/comments/abc123/title/?utm=x#top")).toBe(
      "https://reddit.com/r/diabetes/comments/abc123/title",
    );
  });
  it("returns null for garbage", () => {
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("manualExternalId", () => {
  it("dedupes the same post pasted with different tracking params", () => {
    const a = manualExternalId("https://reddit.com/r/PCOS/comments/xyz/post?utm_source=share", null, null);
    const b = manualExternalId("https://www.reddit.com/r/PCOS/comments/xyz/post/", null, null);
    expect(a).toBe(b);
  });
  it("falls back to a text hash when there is no url", () => {
    const a = manualExternalId(null, "Useless for Indian food", "It said pasta.");
    const b = manualExternalId(null, "useless for indian food ", " it said pasta.");
    expect(a).toBe(b);
    expect(a.startsWith("text:")).toBe(true);
  });
});

describe("reddit helpers", () => {
  it("extracts ids and subreddits", () => {
    const u = "https://www.reddit.com/r/type2diabetes/comments/1abc9z/metformin_and_rice/";
    expect(redditIdFromUrl(u)).toBe("1abc9z");
    expect(subredditFromUrl(u)).toBe("type2diabetes");
  });
  it("keeps two comments on one post as two items", () => {
    const a = "https://www.reddit.com/r/PCOS/comments/1abc9z/metformin_and_rice/k1x2y3z/";
    const b = "https://www.reddit.com/r/PCOS/comments/1abc9z/metformin_and_rice/m9n8o7p/?context=3";
    expect(redditIdFromUrl(a)).toBe("1abc9z:k1x2y3z");
    expect(redditIdFromUrl(b)).toBe("1abc9z:m9n8o7p");
    expect(redditIdFromUrl(a)).not.toBe(redditIdFromUrl(b));
  });
  it("understands the current /comment/<id>/ permalink format", () => {
    const a = "https://www.reddit.com/r/PCOS/comments/1abc9z/metformin_and_rice/comment/k1x2y3z/";
    const b = "https://www.reddit.com/r/PCOS/comments/1abc9z/metformin_and_rice/comment/m9n8o7p/?context=3";
    expect(redditIdFromUrl(a)).toBe("1abc9z:k1x2y3z");
    expect(redditIdFromUrl(b)).toBe("1abc9z:m9n8o7p");
  });
  it("understands redd.it short links and posts without a slug", () => {
    expect(redditIdFromUrl("https://redd.it/1abc9z")).toBe("1abc9z");
    expect(redditIdFromUrl("https://www.reddit.com/r/PCOS/comments/1abc9z/")).toBe("1abc9z");
    expect(redditIdFromUrl("https://www.reddit.com/r/PCOS/comments/1abc9z/some_title/")).toBe("1abc9z");
    expect(redditIdFromUrl("https://example.com/nothing")).toBeNull();
  });
});
