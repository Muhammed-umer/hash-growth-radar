import "server-only";
import { askJSON } from "../ai";
import { CLASSIFY_SYSTEM, classifyUser } from "../ai/prompts";
import { ClassificationSchema, type Classification, type ItemRow } from "../types";

export async function classify(
  item: Pick<ItemRow, "platform" | "community" | "title" | "body" | "meta">,
): Promise<{ classification: Classification; model: string }> {
  const res = await askJSON({
    system: CLASSIFY_SYSTEM,
    user: classifyUser(item),
    schema: ClassificationSchema,
    maxTokens: 1024, // room for the JSON even if the model spends some tokens thinking
  });
  return { classification: res.data, model: `${res.provider}:${res.model}` };
}
