import "server-only";
import { NAV_PLATFORMS, TOP_N } from "./config";
import { db } from "./db";
import type { ItemRow, ItemStatus, Platform, RunRow, TagRow } from "./types";

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

export async function loadQueue(opts: { platform?: Platform; statuses?: ItemStatus[]; limit?: number } = {}): Promise<QueueEntry[]> {
  let q = db()
    .from("items")
    .select("*")
    .in("status", opts.statuses ?? ["tagged"])
    .order("score", { ascending: false, nullsFirst: false })
    .order("collected_at", { ascending: false })
    .limit(opts.limit ?? TOP_N);
  // One platform, or every platform shown in the navbar.
  q = opts.platform ? q.eq("platform", opts.platform) : q.in("platform", NAV_PLATFORMS);
  const res = await q;
  if (res.error) throw new Error(`loadQueue: ${res.error.message}`);
  const items = (res.data ?? []) as ItemRow[];
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id);
  const tags = await db().from("tags").select("*").in("item_id", ids);
  if (tags.error) throw new Error(`loadQueue tags: ${tags.error.message}`);

  const tagBy = new Map((tags.data as TagRow[]).map((t) => [t.item_id, t]));
  return items.map((item) => ({ item, tag: tagBy.get(item.id) ?? null }));
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
