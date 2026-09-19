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
  if (h < 48) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
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
  skipped: "Skipped",
  posted: "Approached (old)",
};

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
