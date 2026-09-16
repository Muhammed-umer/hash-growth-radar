import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { env, requireEnv } from "../env";
import type { ProviderCall, ProviderResult } from "./index";

/**
 * Optional second provider. The founder asked for the cheapest option, so the
 * default is Claude Haiku 4.5 ($1 / $5 per million tokens); set ANTHROPIC_MODEL
 * to claude-sonnet-5 or claude-opus-5 for stronger tagging.
 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client) return client;
  client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return client;
}

export async function askAnthropicJSON(call: ProviderCall): Promise<ProviderResult> {
  const model = env("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL;
  // jsonSchemaOutputFormat moves keywords Anthropic's structured outputs do
  // not accept (minimum/maximum, ...) into descriptions. zod still enforces
  // them locally when the answer comes back.
  const format = jsonSchemaOutputFormat(call.jsonSchema as { type: "object" });
  const response = await anthropic().messages.create({
    model,
    max_tokens: call.maxTokens,
    system: call.system,
    messages: [{ role: "user", content: call.user }],
    output_config: { format },
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text) throw new Error("Claude returned an empty response");
  return { text, model };
}
