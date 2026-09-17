import "server-only";
import { db, must } from "../db";
import type { ChannelRow, FoundVia, SweepUnitRow, TopicRow, VideoRow } from "../types";
import { groupByShape } from "./rules";

/** A video as any discovery call returns it, ready for upsert_videos. */
export interface VideoSeed {
  video_id: string;
  channel_id: string | null;
  channel_title: string | null;
  title: string | null;
  published_at: string | null;
}

// ---------------------------------------------------------------------------
// topics
// ---------------------------------------------------------------------------

/** Make the topics table match config: new phrases added, missing ones deactivated. */
export async function seedTopics(phrases: string[]): Promise<TopicRow[]> {
  const list = [...new Set(phrases.map((p) => p.trim()).filter(Boolean))];
  if (list.length === 0) throw new Error("config has no YouTube topics");
  {
    const up = await db()
      .from("topics")
      .upsert(list.map((phrase) => ({ phrase, active: true })), { onConflict: "phrase", ignoreDuplicates: true });
    if (up.error) throw new Error(`seedTopics upsert: ${up.error.message}`);
    const re = await db().from("topics").update({ active: true, updated_at: new Date().toISOString() }).in("phrase", list).eq("active", false);
    if (re.error) throw new Error(`seedTopics reactivate: ${re.error.message}`);
  }
  const off = await db()
    .from("topics")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("active", true)
    .not("phrase", "in", `(${list.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(",")})`);
  if (off.error) throw new Error(`seedTopics deactivate: ${off.error.message}`);
  return listTopics();
}

export async function listTopics(activeOnly = true): Promise<TopicRow[]> {
  let q = db().from("topics").select("*").order("created_at");
  if (activeOnly) q = q.eq("active", true);
  const res = await q;
  if (res.error) throw new Error(`listTopics: ${res.error.message}`);
  return (res.data ?? []) as TopicRow[];
}

export async function updateTopic(phrase: string, patch: Partial<TopicRow>): Promise<void> {
  const res = await db().from("topics").update({ ...patch, updated_at: new Date().toISOString() }).eq("phrase", phrase);
  if (res.error) throw new Error(`updateTopic: ${res.error.message}`);
}

// ---------------------------------------------------------------------------
// videos and channels
// ---------------------------------------------------------------------------

/** Store a page of videos (and their channels). Returns how many were new. */
export async function upsertVideos(rows: VideoSeed[], topic: string | null, foundVia: FoundVia): Promise<number> {
  if (rows.length === 0) return 0;
  const res = await db().rpc("upsert_videos", { p_rows: rows, p_topic: topic, p_found_via: foundVia });
  if (res.error) throw new Error(`upsert_videos: ${res.error.message}`);
  return Number(res.data ?? 0);
}

/** Active videos whose next check is due, oldest due first. */
export async function videosDueForCheck(now: Date, limit: number): Promise<VideoRow[]> {
  const res = await db()
    .from("videos")
    .select("*")
    .eq("status", "active")
    .lte("next_check_at", now.toISOString())
    .order("next_check_at")
    .limit(limit);
  if (res.error) throw new Error(`videosDueForCheck: ${res.error.message}`);
  return (res.data ?? []) as VideoRow[];
}

/** Batch update by primary key. Rows are grouped by shape so each only touches the columns it names. */
export async function patchVideos(patches: Array<Partial<VideoRow> & { video_id: string }>): Promise<void> {
  for (const group of groupByShape(patches)) {
    for (let i = 0; i < group.length; i += 200) {
      const res = await db().from("videos").upsert(group.slice(i, i + 200), { onConflict: "video_id" });
      if (res.error) throw new Error(`patchVideos: ${res.error.message}`);
    }
  }
}

/** Which of these ids are already in the table. */
export async function knownVideoIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const res = await db().from("videos").select("video_id").in("video_id", ids.slice(i, i + 500));
    if (res.error) throw new Error(`knownVideoIds: ${res.error.message}`);
    for (const r of res.data ?? []) out.add(r.video_id as string);
  }
  return out;
}

/** Followed channels that still need their uploads playlist id. */
export async function channelsNeedingPlaylist(limit: number): Promise<ChannelRow[]> {
  const res = await db().from("channels").select("*").eq("followed", true).is("uploads_playlist_id", null).order("first_seen_at").limit(limit);
  if (res.error) throw new Error(`channelsNeedingPlaylist: ${res.error.message}`);
  return (res.data ?? []) as ChannelRow[];
}

/** Followed channels with a playlist whose full history has not been walked. */
export async function channelsNeedingWalk(limit: number): Promise<ChannelRow[]> {
  const res = await db()
    .from("channels")
    .select("*")
    .eq("followed", true)
    .eq("history_walked", false)
    .not("uploads_playlist_id", "is", null)
    .order("on_topic_videos", { ascending: false })
    .limit(limit);
  if (res.error) throw new Error(`channelsNeedingWalk: ${res.error.message}`);
  return (res.data ?? []) as ChannelRow[];
}

/** Walked channels not listed since `before`. */
export async function channelsDueForSweep(before: Date, limit: number): Promise<ChannelRow[]> {
  const res = await db()
    .from("channels")
    .select("*")
    .eq("followed", true)
    .eq("history_walked", true)
    .not("uploads_playlist_id", "is", null)
    .or(`last_swept_at.is.null,last_swept_at.lte.${before.toISOString()}`)
    .order("last_swept_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (res.error) throw new Error(`channelsDueForSweep: ${res.error.message}`);
  return (res.data ?? []) as ChannelRow[];
}

export async function patchChannels(patches: Array<Partial<ChannelRow> & { channel_id: string }>): Promise<void> {
  for (const group of groupByShape(patches)) {
    for (let i = 0; i < group.length; i += 200) {
      const res = await db().from("channels").upsert(group.slice(i, i + 200), { onConflict: "channel_id" });
      if (res.error) throw new Error(`patchChannels: ${res.error.message}`);
    }
  }
}

export async function randomFollowedChannels(n: number): Promise<ChannelRow[]> {
  const res = await db().rpc("random_followed_channels", { p_n: n });
  if (res.error) throw new Error(`random_followed_channels: ${res.error.message}`);
  return (res.data ?? []) as ChannelRow[];
}

// ---------------------------------------------------------------------------
// sweep units
// ---------------------------------------------------------------------------

export async function insertSweepUnits(rows: Array<Pick<SweepUnitRow, "phrase" | "published_after" | "published_before" | "order_by">>): Promise<void> {
  if (rows.length === 0) return;
  const res = await db().from("sweep_units").upsert(rows, { onConflict: "phrase,published_after,published_before,order_by", ignoreDuplicates: true });
  if (res.error) throw new Error(`insertSweepUnits: ${res.error.message}`);
}

/**
 * The unit to work on, for active phrases only: an unfinished one first, else
 * the newest pending window. A phrase removed from config is never swept again.
 */
export async function nextSweepUnit(activePhrases: string[]): Promise<SweepUnitRow | null> {
  if (activePhrases.length === 0) return null;
  const inProgress = await db().from("sweep_units").select("*").eq("status", "in_progress").in("phrase", activePhrases).order("published_before", { ascending: false }).order("id").limit(1).maybeSingle();
  if (inProgress.error) throw new Error(`nextSweepUnit: ${inProgress.error.message}`);
  if (inProgress.data) return inProgress.data as SweepUnitRow;
  const pending = await db().from("sweep_units").select("*").eq("status", "pending").in("phrase", activePhrases).order("published_before", { ascending: false }).order("id").limit(1).maybeSingle();
  if (pending.error) throw new Error(`nextSweepUnit: ${pending.error.message}`);
  return (pending.data as SweepUnitRow | null) ?? null;
}

export async function updateSweepUnit(id: number, patch: Partial<SweepUnitRow>): Promise<SweepUnitRow> {
  return must(
    await db().from("sweep_units").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single(),
    "updateSweepUnit",
  ) as SweepUnitRow;
}

// ---------------------------------------------------------------------------
// page numbers
// ---------------------------------------------------------------------------

export interface WatchlistStats {
  videos_total: number;
  videos_by_status: Record<string, number>;
  videos_by_door: Record<string, number>;
  channels_total: number;
  channels_followed: number;
  channels_walked: number;
  sweep_total: number;
  sweep_done: number;
  sweep_videos: number;
  last_coverage: Record<string, unknown> | null;
}

export async function watchlistStats(): Promise<WatchlistStats> {
  const res = await db().rpc("watchlist_stats");
  if (res.error) throw new Error(`watchlist_stats: ${res.error.message}`);
  const d = (res.data ?? {}) as Partial<WatchlistStats>;
  return {
    videos_total: Number(d.videos_total ?? 0),
    videos_by_status: d.videos_by_status ?? {},
    videos_by_door: d.videos_by_door ?? {},
    channels_total: Number(d.channels_total ?? 0),
    channels_followed: Number(d.channels_followed ?? 0),
    channels_walked: Number(d.channels_walked ?? 0),
    sweep_total: Number(d.sweep_total ?? 0),
    sweep_done: Number(d.sweep_done ?? 0),
    sweep_videos: Number(d.sweep_videos ?? 0),
    last_coverage: d.last_coverage ?? null,
  };
}
