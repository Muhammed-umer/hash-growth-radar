import type { Classification } from "../types";

export interface ScoreInput {
  classification: Classification;
  postedAt: string | null;
  now?: Date;
}

export const INTENT_BONUS: Record<Classification["intent"], number> = {
  medicine_food_question: 15,
  app_recommendation: 10,
  competitor_complaint: 5,
  nutrition_question: 0,
  irrelevant: -1000,
};

export const URGENCY_BONUS: Record<Classification["urgency"], number> = {
  low: 0,
  medium: 3,
  high: 6,
};

/** Points taken off per full day since the comment was posted, and the most that can be taken off. */
export const AGE_PENALTY_PER_DAY = 2;
export const AGE_PENALTY_MAX = 14;

/**
 * Ranking score used to pick the daily top 10. Fit score is the main signal;
 * intent and urgency nudge it; freshness decays 2 points per day. Items the
 * AI marked do_not_reply are excluded by the caller, not scored.
 */
export function score(input: ScoreInput): number {
  const c = input.classification;
  let s = c.fit_score + INTENT_BONUS[c.intent] + URGENCY_BONUS[c.urgency];

  if (input.postedAt) {
    const posted = new Date(input.postedAt).getTime();
    if (!Number.isNaN(posted)) {
      const ageDays = Math.max(0, ((input.now ?? new Date()).getTime() - posted) / 86_400_000);
      s -= Math.min(AGE_PENALTY_MAX, Math.floor(ageDays) * AGE_PENALTY_PER_DAY);
    }
  }

  return Math.round(s * 100) / 100;
}
