/** Pure formatting helpers, safe in server and client code. */

export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "unknown time";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown time";
  const s = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

export function fmtDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "running";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  return ms < 1000 ? `${ms} ms` : `${Math.round(ms / 100) / 10} s`;
}

export const INTENT_LABEL: Record<string, string> = {
  medicine_food_question: "Medicine + food question",
  app_recommendation: "Asking for an app",
  nutrition_question: "Nutrition question",
  competitor_complaint: "Complaint about an app",
  irrelevant: "Irrelevant",
};

export const STATUS_LABEL: Record<string, string> = {
  filtered: "Dropped by filter",
  queued: "Waiting for AI",
  tagged: "To look at",
  do_not_reply: "Not suitable",
  skipped: "Read",
  posted: "Approached (old)",
};

/**
 * The href of another page of the same list: every current query value is
 * kept, ?page= is set (or dropped for page 1).
 */
export function pageHref(sp: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s && k !== "page") params.set(k, s);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

/** The keyword filter's and the AI's drop codes, in words (Recently dropped list). */
export function dropReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "AI: not suitable to approach (dose, diagnosis, emergency, mental health, pregnancy or a child)";
  if (reason === "too_short") return "Too short";
  if (reason === "too_old") return "Posted before January 2026";
  if (reason === "no_keyword") return "Names no medicine, condition, app or food";
  if (reason === "not_a_question") return "Not a question";
  if (reason === "ai:irrelevant") return "AI: not a question Hash can answer";
  if (reason.startsWith("blocked:")) return `Spam word: ${reason.slice(8)}`;
  return reason;
}

/** Colour bands of the score tile on a card. The help panel explains the same bands. */
export const SCORE_BANDS = { strong: 90, good: 70 } as const;

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
