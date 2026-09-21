import "server-only";
import { NAV_PLATFORMS, SHORTLIST } from "./config";
import { shortlistFilter } from "./shortlist";
import { db } from "./db";
import { INTENTS, type Intent, type ItemRow, type ItemStatus, type Platform, type RunRow, type TagRow } from "./types";

export interface QueueEntry {
  item: ItemRow;
  tag: TagRow | null;
}

const EMPTY_COUNTS: Record<ItemStatus, number> = {
  filtered: 0,
  queued: 0,
  tagged: 0,
  do_not_reply: 0,
  skipped: 0,
  posted: 0,
};

/** score: highest score first. latest: newest comment first (by when it was posted on YouTube). */
export type QueueSort = "score" | "latest";

export function parseQueueSort(v: string | string[] | undefined): QueueSort {
  return v === "latest" ? "latest" : "score";
}

/** The filters the platform page offers. Every field is optional; empty means "all". */
export interface QueueFilter {
  intent?: Intent;
  /** A condition or medicine as the AI wrote it, e.g. "metformin" or "type 2 diabetes". */
  term?: string;
  minScore?: number;
  /** Only these intents (the Shortlist uses it). */
  intents?: Intent[];
  /** Only comments posted at or after this ISO instant. */
  postedAfter?: string;
}

export { shortlistFilter };

export const MIN_SCORE_OPTIONS = [60, 70, 80, 90] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseIntent(v: string | string[] | undefined): Intent | undefined {
  const s = first(v);
  return s && (INTENTS as readonly string[]).includes(s) && s !== "irrelevant" ? (s as Intent) : undefined;
}

/** Only letters, digits, spaces, hyphens and apostrophes reach the query; anything else is ignored. */
export function parseTerm(v: string | string[] | undefined): string | undefined {
  const s = first(v)?.trim().toLowerCase() ?? "";
  return s && /^[a-z0-9][a-z0-9 \-']{0,60}$/.test(s) ? s : undefined;
}

export function parseMinScore(v: string | string[] | undefined): number | undefined {
  const n = Number(first(v));
  return (MIN_SCORE_OPTIONS as readonly number[]).includes(n) ? n : undefined;
}

export function parsePage(v: string | string[] | undefined): number {
  const n = Number.parseInt(first(v) ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function normaliseTag(raw: unknown): TagRow | null {
  if (Array.isArray(raw)) return (raw[0] as TagRow | undefined) ?? null;
  return (raw as TagRow | null) ?? null;
}

/**
 * One page of the list with its total. Tags come embedded in the same query
 * so the tag filters can be applied in the database; `tags!inner` turns the
 * join into a requirement only when a tag filter is on, so untagged rows in
 * other statuses still appear when a caller asks for them.
 */
export async function loadQueuePage(
  opts: { platform?: Platform; statuses?: ItemStatus[]; limit?: number; offset?: number; sort?: QueueSort; filter?: QueueFilter } = {},
): Promise<{ entries: QueueEntry[]; total: number }> {
  const f = opts.filter ?? {};
  const needsTags = Boolean(f.intent || f.term || f.intents);
  let q = db()
    .from("items")
    .select(needsTags ? "*, tags!inner(*)" : "*, tags(*)", { count: "exact" })
    .in("status", opts.statuses ?? ["tagged"]);
  q = opts.platform ? q.eq("platform", opts.platform) : q.in("platform", NAV_PLATFORMS);
  if (f.intent) q = q.eq("tags.intent", f.intent);
  if (f.intents) q = q.in("tags.intent", f.intents);
  if (f.postedAfter) q = q.gte("posted_at", f.postedAfter);
  if (f.term) {
    const lit = `{"${f.term.replace(/"/g, "")}"}`;
    q = q.or(`conditions.cs.${lit},medicines.cs.${lit}`, { referencedTable: "tags" });
  }
  if (typeof f.minScore === "number") q = q.gte("score", f.minScore);
  q =
    opts.sort === "latest"
      ? q.order("posted_at", { ascending: false, nullsFirst: false }).order("collected_at", { ascending: false })
      : q.order("score", { ascending: false, nullsFirst: false }).order("collected_at", { ascending: false });
  const limit = opts.limit ?? SHORTLIST.page_size;
  const offset = opts.offset ?? 0;
  const res = await q.range(offset, offset + limit - 1);
  if (res.error) {
    // PostgREST answers 416 when the offset is past the last row (a stale
    // ?page= after items were skipped or deleted). Fall back to the first page;
    // the caller clamps the page number from the total it gets back.
    if (offset > 0 && /range not satisfiable/i.test(res.error.message)) return loadQueuePage({ ...opts, offset: 0 });
    throw new Error(`loadQueue: ${res.error.message}`);
  }
  const rows = (res.data ?? []) as Array<ItemRow & { tags: unknown }>;
  const entries = rows.map(({ tags, ...item }) => ({ item: item as ItemRow, tag: normaliseTag(tags) }));
  return { entries, total: res.count ?? entries.length };
}

export async function loadQueue(opts: { platform?: Platform; statuses?: ItemStatus[]; limit?: number; sort?: QueueSort } = {}): Promise<QueueEntry[]> {
  return (await loadQueuePage(opts)).entries;
}

/** How many comments are on the Shortlist right now (the nav badge). */
export async function shortlistCount(now = new Date()): Promise<number> {
  const f = shortlistFilter(now);
  const res = await db()
    .from("items")
    .select("id, tags!inner(intent)", { count: "exact", head: true })
    .eq("status", "tagged")
    .in("platform", NAV_PLATFORMS)
    .in("tags.intent", f.intents)
    .gte("score", f.minScore)
    .gte("posted_at", f.postedAfter);
  if (res.error) throw new Error(`shortlistCount: ${res.error.message}`);
  return res.count ?? 0;
}

export interface TagFacets {
  conditions: Array<[string, number]>;
  medicines: Array<[string, number]>;
}

/**
 * The conditions and medicines the AI actually wrote on the listed comments,
 * most frequent first, so the filter dropdown offers real values rather than a
 * fixed list. Reads at most 3,000 rows; the list is a rolling month, so that
 * is plenty.
 */
export async function tagFacets(platform: Platform, top = 25): Promise<TagFacets> {
  const res = await db().from("items").select("id, tags!inner(conditions, medicines)").eq("status", "tagged").eq("platform", platform).limit(3000);
  if (res.error) throw new Error(`tagFacets: ${res.error.message}`);
  const cond = new Map<string, number>();
  const med = new Map<string, number>();
  for (const row of (res.data ?? []) as Array<{ tags: unknown }>) {
    const t = normaliseTag(row.tags);
    if (!t) continue;
    for (const c of t.conditions ?? []) cond.set(c, (cond.get(c) ?? 0) + 1);
    for (const m of t.medicines ?? []) med.set(m, (med.get(m) ?? 0) + 1);
  }
  const rank = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top);
  return { conditions: rank(cond), medicines: rank(med) };
}

export type StatusCounts = Record<Platform, Record<ItemStatus, number>>;

export async function statusCounts(): Promise<StatusCounts> {
  const res = await db().rpc("item_status_counts");
  if (res.error) throw new Error(`item_status_counts: ${res.error.message}`);
  const out = {} as StatusCounts;
  for (const row of (res.data ?? []) as Array<{ platform: Platform; status: ItemStatus; n: number }>) {
    out[row.platform] ??= { ...EMPTY_COUNTS };
    out[row.platform][row.status] = Number(row.n);
  }
  return out;
}

export function countsFor(all: StatusCounts, platform: Platform): Record<ItemStatus, number> {
  return all[platform] ?? { ...EMPTY_COUNTS };
}

export async function recentRuns(platform: Platform, limit = 10): Promise<RunRow[]> {
  const res = await db().from("runs").select("*").eq("platform", platform).order("started_at", { ascending: false }).limit(limit);
  if (res.error) throw new Error(`recentRuns: ${res.error.message}`);
  return (res.data ?? []) as RunRow[];
}

export async function jobCounts(): Promise<Record<string, number>> {
  const res = await db().rpc("job_counts");
  if (res.error) throw new Error(`job_counts: ${res.error.message}`);
  const out: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const row of (res.data ?? []) as Array<{ status: string; n: number }>) out[row.status] = Number(row.n);
  return out;
}

/** Recent items that were dropped, so the platform page can show why. */
export async function recentDropped(platform: Platform, limit = 8): Promise<ItemRow[]> {
  const res = await db()
    .from("items")
    .select("*")
    .eq("platform", platform)
    .in("status", ["filtered", "do_not_reply"])
    .order("collected_at", { ascending: false })
    .limit(limit);
  if (res.error) throw new Error(`recentDropped: ${res.error.message}`);
  return (res.data ?? []) as ItemRow[];
}
