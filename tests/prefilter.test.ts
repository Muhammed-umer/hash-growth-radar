import { describe, expect, it } from "vitest";
import { containsTerm, looksLikeQuestion, prefilter } from "@/lib/pipeline/prefilter";
import { CONFIG } from "@/lib/config";

const rules = { allow: [...CONFIG.keywords_allow], block: [...CONFIG.keywords_block] };
const now = new Date("2026-09-16T10:00:00Z");

describe("containsTerm", () => {
  it("matches whole words and phrases, case-insensitively", () => {
    expect(containsTerm("cal ai keeps getting my dal wrong", "cal ai")).toBe(true);
    expect(containsTerm("Started Metformin last week", "metformin")).toBe(true);
    expect(containsTerm("the price is high", "rice")).toBe(false);
    expect(containsTerm("ricecooker", "rice")).toBe(false);
  });
});

describe("prefilter", () => {
  it("passes a fresh medicine + food question", () => {
    const r = prefilter(
      {
        title: "Doctor put me on metformin last week",
        body: "Is it fine to keep eating rice and roti?",
        postedAt: "2026-09-15T10:00:00Z",
        now,
      },
      rules,
    );
    expect(r).toEqual({ pass: true });
  });

  it("drops comments posted before the floor date (1 Jan 2026)", () => {
    const r = prefilter(
      { title: "metformin and rice?", body: "long enough text here", postedAt: "2025-12-31T23:59:59Z", now },
      rules,
    );
    expect(r).toEqual({ pass: false, reason: "too_old" });
  });

  it("keeps an old comment from this year (the watch list reads whole threads)", () => {
    const r = prefilter(
      { title: "metformin and rice?", body: "long enough text here", postedAt: "2026-01-02T10:00:00Z", now },
      rules,
    );
    expect(r).toEqual({ pass: true });
  });

  it("drops items with no relevant keyword", () => {
    const r = prefilter(
      { title: "Show off: a new terminal emulator", body: "It is written in Rust.", postedAt: "2026-09-15T10:00:00Z", now },
      rules,
    );
    expect(r).toEqual({ pass: false, reason: "no_keyword" });
  });

  it("drops blocked noise even if a keyword is present", () => {
    const r = prefilter(
      { title: "Giveaway: free calorie tracker subscription", body: "enter now", postedAt: "2026-09-15T10:00:00Z", now },
      rules,
    );
    expect(r).toEqual({ pass: false, reason: "blocked:giveaway" });
  });

  it("drops very short items", () => {
    expect(prefilter({ title: "metformin", body: "", postedAt: null, now }, rules)).toEqual({
      pass: false,
      reason: "too_short",
    });
  });

  it("keeps only question-like YouTube comments", () => {
    const praise = prefilter(
      { title: null, body: "Great video on diabetes diet, thanks so much!", postedAt: "2026-09-15T10:00:00Z", now },
      rules,
    );
    expect(praise).toEqual({ pass: false, reason: "not_a_question" });

    const q = prefilter(
      { title: null, body: "I'm on metformin, can I follow this diet?", postedAt: "2026-09-15T10:00:00Z", now },
      rules,
    );
    expect(q).toEqual({ pass: true });
  });

  it("passes when postedAt is unknown (manual paste without a date)", () => {
    const r = prefilter({ title: "Useless for Indian food", body: "Photographed my dal chawal and it said pasta. Cal AI is useless, any better app?", postedAt: null, now }, rules);
    expect(r).toEqual({ pass: true });
  });
});

describe("looksLikeQuestion", () => {
  it("detects questions without a question mark", () => {
    expect(looksLikeQuestion("any app that tracks this")).toBe(true);
    expect(looksLikeQuestion("thanks, subscribed")).toBe(false);
  });
});
