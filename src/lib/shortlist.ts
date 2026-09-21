import { SHORTLIST } from "./config";
import type { Intent } from "./types";

/** The filter the Shortlist page and its nav badge apply (src/lib/queries.ts). */
export interface ShortlistFilter {
  intents: Intent[];
  minScore: number;
  /** ISO instant: comments posted before this are left to the platform page. */
  postedAfter: string;
}

export function shortlistFilter(now: Date = new Date()): ShortlistFilter {
  return {
    intents: [...SHORTLIST.intents],
    minScore: SHORTLIST.min_score,
    postedAfter: new Date(now.getTime() - SHORTLIST.max_age_days * 86_400_000).toISOString(),
  };
}
