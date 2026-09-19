import { describe, expect, it } from "vitest";
import { applyIntentGuards, mentionsApp } from "@/lib/pipeline/guards";
import type { Classification } from "@/lib/types";

const base: Classification = {
  intent: "app_recommendation",
  conditions: [],
  medicines: [],
  competitor: null,
  fit_score: 82,
  urgency: "low",
  language: "en",
  do_not_reply: false,
  do_not_reply_reason: null,
  summary: "Asks which is better.",
};

describe("mentionsApp", () => {
  it("matches whole words and brand names, case-insensitively", () => {
    expect(mentionsApp("which app is good for indian food")).toBe(true);
    expect(mentionsApp("Is HealthifyMe worth it?")).toBe(true);
    expect(mentionsApp("any calorie counter that knows dosa")).toBe(true);
  });
  it("does not match inside other words", () => {
    expect(mentionsApp("happy to apply this diet")).toBe(false);
    expect(mentionsApp("which is better sugar or jaggery")).toBe(false);
  });
});

describe("applyIntentGuards", () => {
  it("leaves a real app request alone", () => {
    const c = applyIntentGuards(base, "which app counts calories for indian food?");
    expect(c).toBe(base);
  });

  it("turns a food comparison mis-tagged as an app request into a nutrition question with fit capped", () => {
    const c = applyIntentGuards(base, "which is better, sugar or jaggery?");
    expect(c.intent).toBe("nutrition_question");
    expect(c.fit_score).toBe(50);
  });

  it("keeps a medicine question as medicine_food_question and keeps its fit", () => {
    const c = applyIntentGuards({ ...base, medicines: ["metformin"], fit_score: 88 }, "which is better with metformin, rice or roti?");
    expect(c.intent).toBe("medicine_food_question");
    expect(c.fit_score).toBe(88);
  });

  it("does not raise a fit that was already below the cap", () => {
    const c = applyIntentGuards({ ...base, fit_score: 30 }, "sugar or honey, which is better?");
    expect(c.fit_score).toBe(30);
  });

  it("downgrades a competitor complaint that names no product", () => {
    const c = applyIntentGuards({ ...base, intent: "competitor_complaint" }, "this diet plan never works for me");
    expect(c.intent).toBe("nutrition_question");
    expect(c.competitor).toBeNull();
  });

  it("keeps a competitor complaint when the competitor field is set even if the body is short", () => {
    const c = applyIntentGuards({ ...base, intent: "competitor_complaint", competitor: "Cal AI" }, "it keeps calling my dal pasta");
    expect(c).toBeDefined();
    expect(c.intent).toBe("competitor_complaint");
  });

  it("never touches the other intents", () => {
    for (const intent of ["medicine_food_question", "nutrition_question", "irrelevant"] as const) {
      const c = { ...base, intent };
      expect(applyIntentGuards(c, "anything")).toBe(c);
    }
  });
});
