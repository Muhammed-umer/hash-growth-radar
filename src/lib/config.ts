import type { Platform } from "./types";

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
      "Every 2 hours the schedule searches 4 of the topics, reads the newest comments under the top videos, keeps the questions, and tags them. Free allowance: 100 searches/day plus 10,000 units/day; we use about 48 and 240.",
    requiredEnv: ["YOUTUBE_API_KEY"],
  },
};

export const NAV_PLATFORMS: Platform[] = ["youtube"];

/** Items older than this are never collected and are deleted by the cleanup cron. */
export const RETENTION_DAYS = 7;

/** How many items the Today page shows. */
export const TOP_N = 10;

/** How often the collect cron runs (supabase/migrations/0002_cron.sql: every 2 hours). */
export const RUNS_PER_DAY = 12;

export const CONFIG = {
  /**
   * YouTube search phrases. Each one is the `q` of one search.list call and
   * finds the videos whose comments we read. Topics 1-6 find people asking
   * about food with a medicine or condition; 7-9 find people choosing or
   * complaining about a calorie app.
   */
  youtube_topics: [
    "diabetes diet",
    "type 2 diabetes what to eat",
    "PCOS diet plan",
    "thyroid diet",
    "hypothyroidism diet",
    "Indian weight loss diet",
    "calorie tracking app review",
    "Cal AI review",
    "HealthifyMe review",
  ],
  /**
   * search.list calls per run. The free allowance is 100/day and the cron runs
   * 12 times a day, so 4 per run = 48/day. Topics rotate between runs
   * (rotateTopics in collectors/youtube.ts), so every topic comes up 5-6 times a day.
   */
  youtube_max_searches_per_run: 4,
  /** Videos read per topic (maxResults of search.list, 0-50). */
  youtube_videos_per_topic: 5,
  /** Newest top-level comments read per video (maxResults of commentThreads.list, 1-100). 1 unit regardless. */
  youtube_comments_per_video: 50,

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
    youtube_max_searches_per_run: CONFIG.youtube_max_searches_per_run,
    youtube_videos_per_topic: CONFIG.youtube_videos_per_topic,
    youtube_comments_per_video: CONFIG.youtube_comments_per_video,
    keywords_allow: [...CONFIG.keywords_allow],
    keywords_block: [...CONFIG.keywords_block],
  };
}
