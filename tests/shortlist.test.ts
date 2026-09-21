import { describe, expect, it } from "vitest";
import { SHORTLIST } from "@/lib/config";
import { shortlistFilter } from "@/lib/shortlist";

describe("shortlistFilter", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const f = shortlistFilter(now);

  it("keeps only medicine, app and complaint questions", () => {
    expect(f.intents).toEqual(["medicine_food_question", "app_recommendation", "competitor_complaint"]);
    expect(f.intents).not.toContain("nutrition_question");
    expect(f.intents).not.toContain("irrelevant");
  });

  it("uses the configured score floor", () => {
    expect(f.minScore).toBe(SHORTLIST.min_score);
    expect(f.minScore).toBe(70);
  });

  it("looks back exactly max_age_days from now", () => {
    expect(SHORTLIST.max_age_days).toBe(30);
    expect(f.postedAfter).toBe("2026-08-22T12:00:00.000Z");
  });

  it("returns a fresh copy of the intents each time", () => {
    const g = shortlistFilter(now);
    g.intents.pop();
    expect(shortlistFilter(now).intents).toHaveLength(3);
  });
});
