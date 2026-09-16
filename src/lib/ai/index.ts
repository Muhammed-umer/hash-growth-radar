import "server-only";
import { z } from "zod";
import { env, geminiApiKeys } from "../env";
import { askAnthropicJSON } from "./anthropic";
import { askGeminiJSON } from "./gemini";

export type Provider = "gemini" | "anthropic";

export interface AskJSONArgs<T> {
  /** Stable instructions. Keep the same string across calls where possible. */
  system: string;
  /** The item-specific part. */
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface AskJSONResult<T> {
  data: T;
  model: string;
  provider: Provider;
}

export interface ProviderCall {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
}

export interface ProviderResult {
  text: string;
  model: string;
}

export function currentProvider(): Provider {
  const p = (env("AI_PROVIDER") ?? "gemini").toLowerCase();
  return p === "anthropic" ? "anthropic" : "gemini";
}

/** Standard JSON Schema for a zod schema, without keys the providers reject. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/** Pull the JSON object out of a reply that may be wrapped in a code fence or prose. */
export function extractJson(text: string): string {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}

/**
 * The one function every AI use in the app goes through. Provider and model
 * are environment settings, so switching from the free Gemini tier to Claude
 * is a config change, not a code change. Output is validated against the zod
 * schema; on a bad answer we ask once more with the validation error attached.
 */
export async function askJSON<T>(args: AskJSONArgs<T>): Promise<AskJSONResult<T>> {
  const provider = currentProvider();
  const call: ProviderCall = {
    system: args.system,
    user: args.user,
    jsonSchema: toJsonSchema(args.schema),
    maxTokens: args.maxTokens ?? 1024,
  };
  const run = provider === "anthropic" ? askAnthropicJSON : askGeminiJSON;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await run(
      attempt === 0
        ? call
        : { ...call, user: `${call.user}\n\nYour previous answer was not valid JSON for the schema (${lastError}). Answer again with only the JSON object.` },
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(res.text));
    } catch (e) {
      lastError = `JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
      continue;
    }
    const v = args.schema.safeParse(parsed);
    if (v.success) return { data: v.data, model: res.model, provider };
    lastError = v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 500);
  }
  throw new Error(`AI returned invalid output twice: ${lastError}`);
}

export function aiConfigured(): { ok: boolean; provider: Provider; reason?: string; keys?: number } {
  const provider = currentProvider();
  if (provider === "anthropic") {
    return env("ANTHROPIC_API_KEY") ? { ok: true, provider, keys: 1 } : { ok: false, provider, reason: "ANTHROPIC_API_KEY is not set" };
  }
  const keys = geminiApiKeys().length;
  return keys > 0
    ? { ok: true, provider, keys }
    : { ok: false, provider, reason: "No Gemini key set (GEMINI_API_KEY or GEMINI_API_KEY_1..8)" };
}
