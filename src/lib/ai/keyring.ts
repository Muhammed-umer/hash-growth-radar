/**
 * Round-robin over several API keys, with a cooldown for keys that just hit a
 * rate limit. Pure and clock-injectable so it can be unit tested.
 *
 * Why: Google's free Gemini tier limits requests per minute and per day per
 * key. Spreading calls across several keys multiplies the usable rate, and
 * parking a key that returned 429 avoids hammering it.
 */
export class Keyring {
  private idx = 0;
  private readonly cooldownUntil = new Map<string, number>();

  constructor(
    private readonly keys: string[],
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.keys.length;
  }

  /** Keys not currently parked. */
  available(): number {
    const t = this.now();
    return this.keys.filter((k) => (this.cooldownUntil.get(k) ?? 0) <= t).length;
  }

  /**
   * The next usable key, advancing the rotation. Skips keys still cooling
   * down. Returns null when every key is parked.
   */
  next(): string | null {
    if (this.keys.length === 0) return null;
    const t = this.now();
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[this.idx % this.keys.length];
      this.idx = (this.idx + 1) % this.keys.length;
      if ((this.cooldownUntil.get(key) ?? 0) <= t) return key;
    }
    return null;
  }

  /** Park a key for `ms` milliseconds (extends an existing cooldown, never shortens it). */
  penalize(key: string, ms: number): void {
    const until = this.now() + ms;
    const current = this.cooldownUntil.get(key) ?? 0;
    if (until > current) this.cooldownUntil.set(key, until);
  }

  /** Milliseconds until this key is usable again (0 if usable now). */
  cooldownRemaining(key: string): number {
    return Math.max(0, (this.cooldownUntil.get(key) ?? 0) - this.now());
  }

  /** Shortest wait until some key becomes usable, or null if one is usable now / there are no keys. */
  nextAvailableIn(): number | null {
    if (this.keys.length === 0 || this.available() > 0) return null;
    const t = this.now();
    return Math.min(...this.keys.map((k) => (this.cooldownUntil.get(k) ?? 0) - t));
  }
}

/** True when an error from a provider means "slow down" rather than "you are wrong". */
export function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  if (status === 429) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /\b429\b|RESOURCE_EXHAUSTED|rate[ _-]?limit|quota/i.test(message);
}

/**
 * How long to park a key: a daily quota is not coming back in a minute.
 * Only wording that clearly says "per day" counts as daily; Gemini's
 * per-minute 429 bodies also contain the word "quota", so that alone is not
 * enough (it would park every key for an hour on a one-minute limit).
 */
export function cooldownForError(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const daily = /PerDay|per day|daily/i.test(message);
  return daily ? 60 * 60_000 : 65_000;
}

/** Thrown when every configured key is parked. The queue waits instead of failing jobs. */
export class AllKeysParkedError extends Error {
  constructor(
    message: string,
    public readonly retryInMs: number,
  ) {
    super(message);
    this.name = "AllKeysParkedError";
  }
}
