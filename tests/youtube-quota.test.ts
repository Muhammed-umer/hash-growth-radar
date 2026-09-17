import { describe, expect, it } from "vitest";
import { memoryLedger, QuotaBudgetReached, quotaDay } from "@/lib/youtube/quota";

describe("quotaDay", () => {
  it("is the Pacific date: 06:59 UTC on 17 Sep is still 16 Sep in Los Angeles (PDT, UTC-7)", () => {
    expect(quotaDay(new Date("2026-09-17T06:59:00Z"))).toBe("2026-09-16");
    expect(quotaDay(new Date("2026-09-17T07:01:00Z"))).toBe("2026-09-17");
  });

  it("uses UTC-8 in winter (PST): 07:59 UTC on 15 Jan is still 14 Jan", () => {
    expect(quotaDay(new Date("2026-01-15T07:59:00Z"))).toBe("2026-01-14");
    expect(quotaDay(new Date("2026-01-15T08:01:00Z"))).toBe("2026-01-15");
  });
});

describe("Ledger", () => {
  it("counts searches and units in separate pots and throws at the cap", async () => {
    const l = memoryLedger({ searches: 2, units: 3 }, () => new Date("2026-09-17T12:00:00Z"));
    await l.spend("searches");
    await l.spend("searches");
    await l.spend("units", 3);
    expect(await l.today()).toEqual({ searches: 2, units: 3 });
    await expect(l.spend("searches")).rejects.toBeInstanceOf(QuotaBudgetReached);
    await expect(l.spend("units")).rejects.toBeInstanceOf(QuotaBudgetReached);
  });

  it("canSpend respects a lower limit than the cap (the sweep's 88)", async () => {
    const l = memoryLedger({ searches: 95, units: 9000 }, () => new Date("2026-09-17T12:00:00Z"));
    await l.spend("searches", 88);
    expect(await l.canSpend("searches", 1, 88)).toBe(false);
    expect(await l.canSpend("searches", 1)).toBe(true);
  });

  it("starts a fresh count after the Pacific midnight reset", async () => {
    let now = new Date("2026-09-17T06:00:00Z");
    const l = memoryLedger({ searches: 1, units: 1 }, () => now);
    await l.spend("searches");
    await expect(l.spend("searches")).rejects.toBeInstanceOf(QuotaBudgetReached);
    now = new Date("2026-09-17T08:00:00Z"); // new quota day
    await expect(l.spend("searches")).resolves.toEqual({ searches: 1, units: 0 });
  });
});
