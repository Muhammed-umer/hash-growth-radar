/**
 * Central place to read environment variables. Values never leave the server;
 * the Settings page only shows whether a key is present.
 */
export const ENV_KEYS = [
  { key: "SUPABASE_URL", purpose: "Supabase project URL (server only)", required: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Supabase service role key (server only)", required: true },
  { key: "CRON_SECRET", purpose: "Protects the /api/cron/* routes", required: true },
  { key: "AI_PROVIDER", purpose: "gemini (default, free tier) or anthropic", required: false },
  { key: "GEMINI_API_KEY", purpose: "Google AI Studio key. GEMINI_API_KEY_1..8 also work, and are rotated", required: false },
  { key: "GEMINI_MODEL", purpose: "Gemini model id (default in code)", required: false },
  { key: "ANTHROPIC_API_KEY", purpose: "Optional: Claude for tagging", required: false },
  { key: "ANTHROPIC_MODEL", purpose: "Claude model id (default in code)", required: false },
  { key: "YOUTUBE_API_KEY", purpose: "YouTube Data API v3 key (Google Cloud console)", required: false },
  { key: "REDDIT_CLIENT_ID", purpose: "Reddit app id (only after Reddit approves access)", required: false },
  { key: "REDDIT_CLIENT_SECRET", purpose: "Reddit app secret (only after Reddit approves access)", required: false },
  { key: "REDDIT_USER_AGENT", purpose: "Reddit requires a descriptive user agent", required: false },
] as const;

export type EnvKey = (typeof ENV_KEYS)[number]["key"];

/** Highest GEMINI_API_KEY_<n> the app looks for. */
export const MAX_GEMINI_KEYS = 8;

export function env(key: EnvKey): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function requireEnv(key: EnvKey): string {
  const v = env(key);
  if (!v) throw new Error(`Missing environment variable ${key}`);
  return v;
}

/**
 * Every Gemini key that is set, in order: GEMINI_API_KEY first, then
 * GEMINI_API_KEY_1 .. _8. Duplicates are dropped. Several keys let the app
 * rotate and stay inside the free per-minute limit.
 */
export function geminiApiKeys(): string[] {
  const out: string[] = [];
  const single = process.env.GEMINI_API_KEY?.trim();
  if (single) out.push(single);
  for (let i = 1; i <= MAX_GEMINI_KEYS; i++) {
    const v = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (v) out.push(v);
  }
  return [...new Set(out)];
}

export interface EnvPresence {
  key: EnvKey;
  purpose: string;
  required: boolean;
  present: boolean;
  note?: string;
}

export function envPresence(): EnvPresence[] {
  return ENV_KEYS.map((e) => {
    if (e.key === "GEMINI_API_KEY") {
      const n = geminiApiKeys().length;
      return { ...e, present: n > 0, note: n > 1 ? `${n} keys, rotated` : n === 1 ? "1 key" : undefined };
    }
    return { ...e, present: env(e.key) !== undefined };
  });
}
