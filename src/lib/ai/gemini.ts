import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env, geminiApiKeys } from "../env";
import type { ProviderCall, ProviderResult } from "./index";
import { AllKeysParkedError, cooldownForError, isRateLimited, Keyring } from "./keyring";

// Verified against ai.google.dev docs and the @google/genai 2.22 source on 16 Sep 2026.
// gemini-3.5-flash-lite: cheapest current Flash model, free tier, structured outputs supported.
// (gemini-2.5-flash-lite stopped accepting new users in 2026 and returns 404.)
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const clients = new Map<string, GoogleGenAI>();
let ring: Keyring | null = null;
let ringKeys = "";

/** One client per key, built lazily. */
function clientFor(key: string): GoogleGenAI {
  const existing = clients.get(key);
  if (existing) return existing;
  const c = new GoogleGenAI({
    apiKey: key,
    // Retries are OFF in the JS SDK unless retryOptions is given. Kept short so
    // one job never exceeds the 60 s margin the queue reserves per job.
    // A 429 is handled by rotating to the next key instead of waiting here.
    httpOptions: { retryOptions: { attempts: 2, initialDelay: 2, maxDelay: 5, httpStatusCodes: [500, 502, 503, 504] }, timeout: 25_000 },
  });
  clients.set(key, c);
  return c;
}

/** The rotation, rebuilt if the configured keys change. */
export function geminiKeyring(): Keyring {
  const keys = geminiApiKeys();
  const fingerprint = keys.join("|");
  if (!ring || fingerprint !== ringKeys) {
    ring = new Keyring(keys);
    ringKeys = fingerprint;
  }
  return ring;
}

/**
 * Ask Gemini, rotating through the configured keys. A key that returns a rate
 * limit is parked (one minute, or an hour for a daily quota) and the next key
 * is tried immediately, so one exhausted key does not fail the job.
 */
export async function askGeminiJSON(call: ProviderCall): Promise<ProviderResult> {
  const model = env("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL;
  const keys = geminiKeyring();
  if (keys.size === 0) throw new Error("No Gemini key configured. Set GEMINI_API_KEY or GEMINI_API_KEY_1..8 in .env.local");

  let lastError: unknown = null;
  for (let attempt = 0; attempt < keys.size; attempt++) {
    const key = keys.next();
    if (!key) break;
    try {
      const response = await clientFor(key).models.generateContent({
        model,
        contents: call.user,
        config: {
          systemInstruction: call.system,
          responseMimeType: "application/json",
          responseJsonSchema: call.jsonSchema,
          maxOutputTokens: call.maxTokens,
          temperature: 0.2,
        },
      });
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response");
      return { text, model };
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      keys.penalize(key, cooldownForError(e));
      lastError = e;
    }
  }

  const waitMs = Math.max(65_000, keys.nextAvailableIn() ?? 0);
  throw new AllKeysParkedError(
    `All ${keys.size} Gemini key(s) are rate limited. Try again in about ${Math.ceil(waitMs / 60_000)} min. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    waitMs,
  );
}
