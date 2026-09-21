import type { Intent, Platform } from "./types";

/**
 * Everything the collector and the filter need, in one place. There is no
 * Settings page any more (removed 16 Sep 2026); change values here and deploy.
 * The "How it works" page in the app reads this file to show the topics.
 */
export interface PlatformInfo {
  key: Platform;
  label: string;
  /** Short line shown on the platform page. */
  blurb: string;
  /** Env vars that must be present for automatic collection. */
  requiredEnv: string[];
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  youtube: {
    key: "youtube",
    label: "YouTube",
    blurb:
      "Every video about the topics is remembered in a watch list: a one-time month-by-month sweep of the year, newest-first searches four times a day, one relevance search a day, and the upload lists of every channel that made an on-topic video. Every 2 hours the comment counts of the watched videos are checked (50 videos per unit) and only the videos that changed are read, newest comment first, up to the last one already seen. Free allowance: 100 searches/day plus 10,000 units/day, counted in a ledger before every call.",
    requiredEnv: ["YOUTUBE_API_KEY"],
  },
};

export const NAV_PLATFORMS: Platform[] = ["youtube"];

/**
 * Stored comments are deleted this many days after YouTube LAST returned them
 * (items.last_seen_at). YouTube's Developer Policy III.E.4.d allows public API
 * data to be kept for at most 30 days unless refreshed; the reader refreshes it.
 * Changed from 7 days on 17 Sep 2026.
 */
export const RETENTION_DAYS = 30;

/**
 * The Shortlist page: the comments worth a look right now. A comment is on it
 * when the AI called it a medicine, app or complaint question (not a general
 * nutrition question), its score is at least min_score, and it was posted in
 * the last max_age_days. Everything tagged stays on the platform page.
 * Added 21 Sep 2026 (replaced the "Today" top 10).
 */
export const SHORTLIST = {
  min_score: 70,
  max_age_days: 30,
  intents: ["medicine_food_question", "app_recommendation", "competitor_complaint"] as Intent[],
  /** Rows per page on the Shortlist and the platform pages. */
  page_size: 25,
} as const;

/**
 * Every knob of the YouTube watch list (docs/coverage-plan.html). Times in
 * hours or days, page limits in pages of the call named.
 */
export const YT = {
  /** Comments posted before this instant are never stored (prefilter "too_old"). */
  comment_floor: "2026-01-01T00:00:00Z",
  /** The month sweep walks back to this date. */
  sweep_floor: "2026-01-01T00:00:00Z",
  /**
   * The sweep stops once the day's searches reach this total, so the discover
   * job keeps its ~30 a day (6 phrases x 4 runs + 6 relevance) under the cap of 95.
   */
  sweep_search_cap: 64,
  /** Pages of 50 per window before we assume the ~500 cap and split the window. */
  sweep_pages_per_window: 10,
  /** Smallest window the sweep will split down to. */
  sweep_min_window_hours: 24,
  /** Pages per topic for the "newest since last look" search; anything deeper is handed to the sweep. */
  discover_pages_per_topic: 5,
  /** Hours between relevance searches of one topic. */
  relevance_every_hours: 20,
  /** First "newest since" search looks back this many days. */
  discover_first_lookback_days: 30,
  /** Overlap subtracted from the watermark (publish times can lag). */
  discover_overlap_hours: 1,
  /** Hours between two upload-list checks of a followed channel. */
  channel_sweep_hours: 20,
  /** Pages (of 50 uploads) a first history walk may read per channel. */
  channel_history_max_pages: 40,
  /** Units the channels job may spend on history walks per run. */
  channel_walk_units_per_run: 2000,
  /** Channels the daily upload check may list per run. */
  channels_per_run: 600,
  /** Videos whose comment count is checked per reader run (50 per unit). Supabase returns at most 1,000 rows per query. */
  checks_per_run: 1000,
  /**
   * The reader stops once the day's units reach this total, so the channels
   * and coverage jobs always keep at least 2,000 of the 9,000.
   */
  reader_unit_cap: 7000,
  /** Wall-clock budget per job run, inside the route's 300 s limit. */
  reader_time_budget_ms: 150_000,
  job_time_budget_ms: 240_000,
  /** Videos whose comments are read per reader run. */
  reads_per_run: 300,
  /** commentThreads pages per reader run in total. */
  pages_per_run: 1500,
  /** commentThreads pages per video per run. */
  pages_per_video_per_run: 10,
  /** Pages a first read of an old video may take across runs. */
  first_read_max_pages: 30,
  /** Videos younger than this are read every run regardless of the count. */
  fresh_days: 7,
  /** Every active video is read at least this often. */
  reread_days: 7,
  /** After this long without a count change a video is checked weekly. */
  quiet_days: 60,
  /** After this long without any change a video is retired. */
  retire_after_days: 180,
  /** A channel with no on-topic upload for this long stops being listed daily. */
  unfollow_after_days: 120,
  /** Channels compared with their real upload list by the weekly coverage check. */
  coverage_sample: 20,
  /** Stop before Google does. */
  ledger_caps: { searches: 95, units: 9000 },
} as const;

export const CONFIG = {
  /**
   * YouTube search phrases. Each one is the `q` of the sweep, "newest since"
   * and relevance searches (src/lib/youtube). All six find people asking
   * about food with a medicine or condition. The three calorie-app phrases
   * were removed on 17 Sep 2026 by the founder's decision. The app seeds the
   * `topics` table from this list on every discover run.
   */
  youtube_topics: [
    "diabetes diet",
    "type 2 diabetes what to eat",
    "PCOS diet plan",
    "thyroid diet",
    "hypothyroidism diet",
    "Indian weight loss diet",
  ],

  /**
   * Keyword prefilter. A comment must contain at least one ALLOW term and no
   * BLOCK term before any AI call happens. Matched case-insensitively as whole
   * words (multi-word terms match as phrases).
   */
  keywords_allow: [
    // medicines
    "metformin", "warfarin", "levothyroxine", "thyroxine", "statin", "atorvastatin", "rosuvastatin",
    "insulin", "amlodipine", "losartan", "telmisartan", "letrozole", "glimepiride", "sitagliptin",
    "empagliflozin", "ozempic", "semaglutide", "mounjaro", "blood thinner", "bp tablet", "sugar tablet",
    "sugar medicine", "bp medicine", "medication", "medicine", "meds", "tablet", "tablets", "pills",
    // conditions
    "diabetes", "diabetic", "prediabetes", "pcos", "pcod", "thyroid", "hypothyroid", "hypothyroidism",
    "hypertension", "blood pressure", "cholesterol", "anemia", "anaemia", "fatty liver", "kidney",
    "blood sugar", "hba1c", "insulin resistance",
    // tracking / apps
    "calorie", "calories", "kcal", "macro", "macros", "protein intake", "calorie counter",
    "calorie tracker", "calorie tracking", "food log", "food logging", "food tracker", "diet app",
    "nutrition app", "track my food", "myfitnesspal", "healthifyme", "healthify", "cal ai", "calai",
    "cafe cal", "lose it", "cronometer", "yazio", "hint app",
    // diet questions
    "what to eat", "what should i eat", "can i eat", "is it safe to eat", "diet plan", "diet chart",
    "meal plan", "indian diet", "roti", "rice", "dal",
  ],
  keywords_block: [
    "giveaway", "promo code", "discount code", "coupon", "hiring", "job opening", "we are hiring",
    "nsfw", "onlyfans", "crypto", "bitcoin", "casino", "betting", "meme", "shitpost",
  ],
} as const;

type Widen<T> = T extends readonly (infer U)[]
  ? Widen<U>[]
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T;

export type Config = {
  -readonly [K in keyof typeof CONFIG]: Widen<(typeof CONFIG)[K]>;
};

/** The config as a plain mutable-typed object (the collector and filter take this). */
export function config(): Config {
  return {
    youtube_topics: [...CONFIG.youtube_topics],
    keywords_allow: [...CONFIG.keywords_allow],
    keywords_block: [...CONFIG.keywords_block],
  };
}
