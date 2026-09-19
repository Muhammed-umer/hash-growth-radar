import type { Classification } from "../types";
import { containsTerm } from "./prefilter";

/**
 * Words that must appear in the text before a comment may be tagged as
 * "asking for an app" or "complaint about an app". Whole-word, case-insensitive.
 * Brand names are included so "is HealthifyMe any good?" still counts.
 */
export const APP_WORDS = [
  "app",
  "apps",
  "application",
  "tracker",
  "software",
  "website",
  "calorie counter",
  "calorie counting",
  "calorie tracking",
  "food log",
  "food logging",
  "food tracker",
  "diet app",
  "nutrition app",
  "myfitnesspal",
  "healthifyme",
  "healthify",
  "cal ai",
  "calai",
  "cafe cal",
  "lose it",
  "cronometer",
  "yazio",
  "hint app",
  "hashhealth",
  "hash health",
] as const;

export function mentionsApp(text: string): boolean {
  return APP_WORDS.some((w) => containsTerm(text, w));
}

/** Fit range the prompt gives a general diet question; a downgraded tag is capped here. */
const NUTRITION_FIT_MAX = 50;

/**
 * Deterministic corrections applied after the AI answers. The model sometimes
 * reads "which is better, sugar or jaggery?" as an app comparison because the
 * shape of the sentence matches; this puts it back. Rules:
 *
 * - app_recommendation or competitor_complaint, but the text never mentions an
 *   app, tracker or known product → it is a food question. If a medicine or
 *   condition was named it becomes medicine_food_question (fit kept); otherwise
 *   nutrition_question with fit capped at 50, the prompt's own ceiling for it.
 * - competitor_complaint with no competitor named → treated the same way.
 *
 * Returns the same object when nothing applies, so callers can compare by
 * identity to know whether a guard fired.
 */
export function applyIntentGuards(c: Classification, text: string): Classification {
  const aboutApps = c.intent === "app_recommendation" || c.intent === "competitor_complaint";
  if (!aboutApps) return c;
  const named = c.intent === "competitor_complaint" ? Boolean(c.competitor) || mentionsApp(text) : mentionsApp(text);
  if (named) return c;

  const hasMedical = c.medicines.length > 0 || c.conditions.length > 0;
  if (hasMedical) return { ...c, intent: "medicine_food_question", competitor: null };
  return { ...c, intent: "nutrition_question", competitor: null, fit_score: Math.min(c.fit_score, NUTRITION_FIT_MAX) };
}
