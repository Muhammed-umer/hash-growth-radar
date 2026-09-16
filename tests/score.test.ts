import { describe, expect, it } from "vitest";
import { score } from "@/lib/pipeline/score";
import type { Classification } from "@/lib/types";

const base: Classification = {
  intent: "medicine_food_question",
  conditions: ["type 2 diabetes"],
  medicines: ["metformin"],
  competitor: null,
  fit_score: 80,
  urgency: "low",
  language: "en",
  do_not_reply: false,
  do_not_reply_reason: null,
  summary: "Asks whether rice and roti are fine on metformin.",
};
const now = new Date("2026-09-16T10:00:00Z");

describe("score", () => {
  it("adds the intent bonus", () => {
    expect(score({ classification: base, postedAt: "2026-09-16T09:00:00Z", now })).toBe(95);
    expect(score({ classification: { ...base, intent: "nutrition_question" }, postedAt: "2026-09-16T09:00:00Z", now })).toBe(80);
  });

  it("decays 2 points per day, capped at 14", () => {
    expect(score({ classification: base, postedAt: "2026-09-13T09:00:00Z", now })).toBe(89);
    expect(score({ classification: base, postedAt: "2026-08-01T09:00:00Z", now })).toBe(81);
  });

  it("sinks irrelevant items far below everything else", () => {
    expect(score({ classification: { ...base, intent: "irrelevant" }, postedAt: null, now })).toBeLessThan(0);
  });

  it("ranks a direct app request above a general nutrition question at equal fit", () => {
    const a = score({ classification: { ...base, intent: "app_recommendation" }, postedAt: null, now });
    const b = score({ classification: { ...base, intent: "nutrition_question" }, postedAt: null, now });
    expect(a).toBeGreaterThan(b);
  });
});
