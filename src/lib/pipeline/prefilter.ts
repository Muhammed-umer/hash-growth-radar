import { RETENTION_DAYS } from "../config";
import type { Platform } from "../types";

export interface PrefilterInput {
  platform: Platform;
  title: string | null;
  body: string | null;
  postedAt: string | null;
  now?: Date;
}

export interface PrefilterRules {
  allow: string[];
  block: string[];
}

export type PrefilterResult = { pass: true } | { pass: false; reason: string };

const QUESTION_HINTS = [
  "?",
  "how ",
  "what ",
  "which ",
  "can i",
  "should i",
  "is it ",
  "any app",
  "recommend",
  "suggest",
  "advice",
  "help",
  "confused",
  "safe to",
  "ok to",
  "okay to",
  "allowed",
];

/** Escape a term for use inside a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word / whole-phrase match, case-insensitive. "cal ai" matches
 * "Cal AI is bad" but "rice" does not match "price".
 */
export function containsTerm(text: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const re = new RegExp(`(^|[^a-z0-9])${esc(t)}(?=$|[^a-z0-9])`, "i");
  return re.test(text);
}

export function looksLikeQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return QUESTION_HINTS.some((h) => lower.includes(h));
}

/**
 * Cheap, deterministic filter that runs before any AI call. It keeps AI cost
 * tiny and never decides anything subtle: it only drops items that are too
 * old, too short, clearly off-topic, or clearly noise.
 */
export function prefilter(input: PrefilterInput, rules: PrefilterRules): PrefilterResult {
  const now = input.now ?? new Date();
  const text = `${input.title ?? ""}\n${input.body ?? ""}`.trim();

  if (text.length < 15) return { pass: false, reason: "too_short" };

  if (input.postedAt) {
    const posted = new Date(input.postedAt);
    if (!Number.isNaN(posted.getTime())) {
      const ageDays = (now.getTime() - posted.getTime()) / 86_400_000;
      if (ageDays > RETENTION_DAYS) return { pass: false, reason: "too_old" };
    }
  }

  const lower = text.toLowerCase();
  const blocked = rules.block.find((b) => containsTerm(lower, b));
  if (blocked) return { pass: false, reason: `blocked:${blocked}` };

  const allowed = rules.allow.some((a) => containsTerm(lower, a));
  if (!allowed) return { pass: false, reason: "no_keyword" };

  // YouTube comments are mostly praise and chatter; we only want questions.
  if (input.platform === "youtube" && !looksLikeQuestion(text)) {
    return { pass: false, reason: "not_a_question" };
  }

  return { pass: true };
}
