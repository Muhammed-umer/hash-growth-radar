import type { Platform } from "./types";

/**
 * Static facts about each platform. Only YouTube and Reddit exist now (Hacker
 * News, the app stores and Product Hunt were removed on 16 Sep 2026 by decision).
 */
export interface PlatformInfo {
  key: Platform;
  label: string;
  mode: "auto" | "manual";
  /** Short line shown on the platform page. */
  blurb: string;
  /** Env vars that must be present for automatic collection. */
  requiredEnv: string[];
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  reddit: {
    key: "reddit",
    label: "Reddit",
    mode: "manual",
    blurb:
      "By hand until Reddit approves API access (required since June 2026). Registering an app at reddit.com/prefs/apps gives two codes but no data; data only flows after a separate access request at support.reddithelp.com is approved. Paste post links here meanwhile. Switches to automatic when REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are set and 'Reddit API enabled' is on in Settings.",
    requiredEnv: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    mode: "auto",
    blurb:
      "Automatic. Searches recent videos on the configured topics and keeps question-like comments. Free allowance: 100 searches/day plus 10,000 units/day.",
    requiredEnv: ["YOUTUBE_API_KEY"],
  },
};

export const NAV_PLATFORMS: Platform[] = ["youtube", "reddit"];

/** Items older than this are never collected and are deleted by the cleanup cron. */
export const RETENTION_DAYS = 7;

/** How many items the Today page shows. */
export const TOP_N = 10;

/**
 * Editable defaults. Anything here can be overridden from the Settings page
 * (stored in the `settings` table under the same key).
 */
export const DEFAULT_SETTINGS = {
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
   * Max search.list calls per collection run. The free allowance is 100/day and
   * the cron runs 12 times a day, so 4 per run = 48/day. Topics rotate between
   * runs, so every topic is still searched at least once a day.
   */
  youtube_max_searches_per_run: 4,
  youtube_videos_per_topic: 5,
  youtube_comments_per_video: 50,

  // Verified to exist on 16 Sep 2026 (member counts in docs/overview.html).
  reddit_subreddits: [
    "diabetes",
    "type2diabetes",
    "prediabetes",
    "PCOS",
    "Hypothyroidism",
    "hypertension",
    "ClotSurvivors",
    "Cholesterol",
    "loseit",
    "nutrition",
    "1200isplenty",
    "intermittentfasting",
    "IndianFitness",
    "india",
    "IndianFood",
  ],
  reddit_queries: [
    "metformin diet",
    "warfarin vitamin K",
    "levothyroxine food",
    "statin grapefruit",
    "PCOS what to eat",
    "best calorie tracker",
    "MyFitnessPal alternative",
    "calorie app Indian food",
    "Cal AI review",
  ],
  reddit_api_enabled: false,

  /**
   * Keyword prefilter. An item must contain at least one ALLOW term and no
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

export type SettingsShape = {
  -readonly [K in keyof typeof DEFAULT_SETTINGS]: Widen<(typeof DEFAULT_SETTINGS)[K]>;
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsShape>;
