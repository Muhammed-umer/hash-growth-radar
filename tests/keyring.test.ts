import { describe, expect, it } from "vitest";
import { cooldownForError, isRateLimited, Keyring } from "@/lib/ai/keyring";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("Keyring rotation", () => {
  it("cycles through the keys in order", () => {
    const r = new Keyring(["a", "b", "c"], clock().now);
    expect([r.next(), r.next(), r.next(), r.next()]).toEqual(["a", "b", "c", "a"]);
  });

  it("skips a parked key and comes back to it after the cooldown", () => {
    const c = clock();
    const r = new Keyring(["a", "b"], c.now);
    expect(r.next()).toBe("a");
    r.penalize("a", 65_000);
    expect(r.available()).toBe(1);
    expect(r.next()).toBe("b");
    expect(r.next()).toBe("b"); // "a" is still parked
    c.advance(66_000);
    expect(r.available()).toBe(2);
    expect([r.next(), r.next()].sort()).toEqual(["a", "b"]);
  });

  it("returns null when every key is parked, and says how long to wait", () => {
    const c = clock();
    const r = new Keyring(["a", "b"], c.now);
    r.penalize("a", 65_000);
    r.penalize("b", 30_000);
    expect(r.next()).toBeNull();
    expect(r.available()).toBe(0);
    expect(r.nextAvailableIn()).toBe(30_000);
    c.advance(31_000);
    expect(r.next()).toBe("b");
    expect(r.nextAvailableIn()).toBeNull();
  });

  it("never shortens an existing cooldown", () => {
    const c = clock();
    const r = new Keyring(["a"], c.now);
    r.penalize("a", 3_600_000);
    r.penalize("a", 60_000);
    expect(r.cooldownRemaining("a")).toBe(3_600_000);
  });

  it("handles an empty keyring", () => {
    const r = new Keyring([], clock().now);
    expect(r.size).toBe(0);
    expect(r.next()).toBeNull();
    expect(r.nextAvailableIn()).toBeNull();
  });
});

describe("isRateLimited", () => {
  it("recognises 429 by status and by message", () => {
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited(new Error("got status 429 RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isRateLimited(new Error("Quota exceeded for quota metric"))).toBe(true);
    expect(isRateLimited(new Error("400 Invalid JSON payload"))).toBe(false);
    expect(isRateLimited(new Error("Gemini returned an empty response"))).toBe(false);
  });
});

describe("cooldownForError", () => {
  it("parks a daily quota far longer than a per-minute limit", () => {
    expect(cooldownForError(new Error("Quota exceeded: requests per day"))).toBe(3_600_000);
    expect(cooldownForError(new Error("rate limit: requests per minute"))).toBe(65_000);
  });
});
