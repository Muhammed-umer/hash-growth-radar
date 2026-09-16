import { z } from "zod";

export const PLATFORMS = ["youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type SourceKind = "auto";

/**
 * filtered     dropped by the keyword filter or tagged irrelevant
 * queued       waiting for the AI
 * tagged       on the list, for you to look at
 * do_not_reply not suitable to approach (dosage, emergency, ...)
 * skipped      you passed on it
 * posted       unused since 16 Sep 2026 (kept so old rows stay valid)
 */
export type ItemStatus = "filtered" | "queued" | "tagged" | "do_not_reply" | "skipped" | "posted";

/** What a collector returns. Deliberately has no author field. */
export interface RawItem {
  platform: Platform;
  sourceKind: SourceKind;
  externalId: string;
  url: string | null;
  community: string | null;
  title: string | null;
  body: string | null;
  postedAt: string | null; // ISO
  meta?: Record<string, unknown>;
}

export interface ItemRow {
  id: string;
  platform: Platform;
  source_kind: SourceKind;
  external_id: string;
  url: string | null;
  community: string | null;
  title: string | null;
  body: string | null;
  posted_at: string | null;
  collected_at: string;
  status: ItemStatus;
  filter_reason: string | null;
  score: number | null;
  meta: Record<string, unknown>;
}

export const INTENTS = [
  "medicine_food_question",
  "app_recommendation",
  "nutrition_question",
  "competitor_complaint",
  "irrelevant",
] as const;
export type Intent = (typeof INTENTS)[number];

export const URGENCIES = ["low", "medium", "high"] as const;

/**
 * The fixed form the AI fills in for every item. It describes the QUESTION in
 * the text, never the person who wrote it.
 */
export const ClassificationSchema = z.object({
  intent: z.enum(INTENTS),
  conditions: z
    .array(z.string())
    .describe("Health conditions named in the text itself, lowercase, e.g. ['type 2 diabetes']. Empty if none."),
  medicines: z
    .array(z.string())
    .describe("Medicines named in the text itself, lowercase, e.g. ['metformin']. Empty if none."),
  competitor: z
    .string()
    .nullable()
    .describe("Competitor app named in the text (Cal AI, HealthifyMe, MyFitnessPal, ...) or null."),
  fit_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100: how well a medication- and condition-aware nutrition tracker answers this exact question."),
  urgency: z.enum(URGENCIES),
  language: z.enum(["en", "hinglish", "other"]),
  do_not_reply: z
    .boolean()
    .describe("true if this is NOT someone to approach: the text asks for a dosage or a diagnosis, describes an emergency, or is about eating disorders or mental health."),
  do_not_reply_reason: z.string().nullable(),
  summary: z.string().describe("One plain sentence saying what is being asked. No names."),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export interface TagRow extends Classification {
  item_id: string;
  model: string | null;
  raw: unknown;
  created_at: string;
}

export interface RunRow {
  id: string;
  platform: Platform;
  trigger: "cron";
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "error" | "skipped";
  fetched: number;
  stored: number;
  duplicates: number;
  filtered_out: number;
  queued: number;
  tagged: number;
  error: string | null;
  notes: Record<string, unknown> | null;
}

export interface JobRow {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  last_error: string | null;
}
