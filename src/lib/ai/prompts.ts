import { truncate } from "../text";
import type { ItemRow } from "../types";

export const CLASSIFY_SYSTEM = `You tag public posts for an internal tool used by the founder of Hash Health, a nutrition tracker that checks meals against a person's medicines and health conditions (type 2 diabetes, PCOS, hypothyroidism, hypertension, cholesterol, blood thinners, and similar).

You fill in a fixed form about the QUESTION in the text. You never describe the person who wrote it.
- conditions / medicines: only what the text itself names. Never guess or infer beyond the words present.
- intent:
  - medicine_food_question: asks what to eat, avoid, or time around a medicine or a named health condition.
  - app_recommendation: asks for or compares calorie, diet, food-logging or nutrition apps.
  - nutrition_question: a general diet or nutrition question with no medicine or condition involved.
  - competitor_complaint: complains about a specific calorie or nutrition app (Cal AI, HealthifyMe, MyFitnessPal, Cafe Cal, Lose It, Hint, Cronometer, Yazio, ...).
  - irrelevant: anything else, including praise, jokes, spam, or posts with no question or complaint.
- fit_score (0-100): how directly a medication- and condition-aware nutrition tracker would answer this exact text. A question about food with a named medicine or condition scores 80-100. A direct request for a calorie app scores 70-90. A complaint that an app fails on Indian food or ignores medication scores 60-85. General diet questions 20-50. Irrelevant 0.
- do_not_reply = true when this is not someone to approach: the text asks for a dosage, asks for a diagnosis, describes an emergency, or concerns eating disorders, self-harm, or mental health. Give a short do_not_reply_reason.
- language: "hinglish" for Hindi-English mix in Latin script, "en" for English, "other" otherwise.
- summary: one plain sentence saying what is asked, without any name or handle.

Answer with only the JSON object.`;

export function classifyUser(item: Pick<ItemRow, "platform" | "community" | "title" | "body">): string {
  return [
    `Platform: ${item.platform}`,
    `Community: ${item.community ?? "unknown"}`,
    `Title: ${item.title ?? "(none)"}`,
    "Text:",
    '"""',
    truncate(item.body ?? "", 4000),
    '"""',
  ].join("\n");
}
