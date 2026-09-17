/**
 * The quota ledger. Google gives two separate daily pots (verified 17 Sep 2026
 * on developers.google.com/youtube/v3/getting-started and /determine_quota_cost):
 *   - 100 search.list calls a day, their own bucket (1 per page, any maxResults)
 *   - 10,000 units a day for every other call we make (1 unit each)
 * Both reset at midnight Pacific time. Every call adds its cost here BEFORE it
 * is made, and the ledger throws when a pot would pass its cap, so the app
 * stops before Google does. No server-only import: pure enough to unit test.
 */

export type QuotaKind = "searches" | "units";

export interface QuotaTotals {
  searches: number;
  units: number;
}

export interface QuotaCaps {
  searches: number;
  units: number;
}

/** Our own stop line, below Google's 100 / 10,000. */
export class QuotaBudgetReached extends Error {
  constructor(
    public readonly kind: QuotaKind,
    public readonly used: number,
    public readonly cap: number,
  ) {
    super(`YouTube ${kind} budget reached for today: ${used} of ${cap}`);
    this.name = "QuotaBudgetReached";
  }
}

/** The quota day (YYYY-MM-DD) that `now` falls in, in America/Los_Angeles. */
export function quotaDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds (searches, units) to the day's row and returns the new totals. */
export type QuotaIncrement = (day: string, searches: number, units: number) => Promise<QuotaTotals>;

export class Ledger {
  private last: { day: string; totals: QuotaTotals } | null = null;

  constructor(
    private readonly increment: QuotaIncrement,
    readonly caps: QuotaCaps,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Count `n` of `kind` before the call. Throws QuotaBudgetReached if the
   * day's total would pass the cap; the count is kept (one over at most),
   * which is the safe direction.
   */
  async spend(kind: QuotaKind, n = 1): Promise<QuotaTotals> {
    const day = quotaDay(this.clock());
    const totals = await this.increment(day, kind === "searches" ? n : 0, kind === "units" ? n : 0);
    this.last = { day, totals };
    if (totals[kind] > this.caps[kind]) throw new QuotaBudgetReached(kind, totals[kind], this.caps[kind]);
    return totals;
  }

  /** Today's totals (a zero increment reads the row). */
  async today(): Promise<QuotaTotals> {
    const day = quotaDay(this.clock());
    if (this.last && this.last.day === day) return this.last.totals;
    const totals = await this.increment(day, 0, 0);
    this.last = { day, totals };
    return totals;
  }

  /** True if `n` more of `kind` would stay within `limit` (default: the cap). */
  async canSpend(kind: QuotaKind, n = 1, limit?: number): Promise<boolean> {
    const t = await this.today();
    return t[kind] + n <= (limit ?? this.caps[kind]);
  }
}

/** In-memory ledger for tests and dry runs. */
export function memoryLedger(caps: QuotaCaps, clock?: () => Date): Ledger {
  const days = new Map<string, QuotaTotals>();
  return new Ledger(
    async (day, s, u) => {
      const t = days.get(day) ?? { searches: 0, units: 0 };
      const next = { searches: t.searches + s, units: t.units + u };
      days.set(day, next);
      return next;
    },
    caps,
    clock,
  );
}
