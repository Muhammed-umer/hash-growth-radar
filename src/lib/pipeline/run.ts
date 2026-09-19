import "server-only";
import { COLLECTORS, CollectorConfigError } from "../collectors";
import { config, YT, type Config } from "../config";
import { db, must } from "../db";
import { AllKeysParkedError } from "../ai/keyring";
import { claim, complete, defer, enqueueMany, fail, JOB_TYPES, releaseStale } from "../queue";
import type { ItemRow, JobRow, Platform, RawItem, RunRow, TagRow } from "../types";
import { classify } from "./classify";
import { applyIntentGuards } from "./guards";
import { prefilter } from "./prefilter";
import { score } from "./score";

export interface IngestResult {
  fetched: number;
  stored: number;
  duplicates: number;
  filtered_out: number;
  queued: number;
  /** Ids of this batch's items that now wait for AI tagging. */
  queuedIds: string[];
}

/** Longest a single tagging job may take (AI timeout × retries + backoff), used as the safety margin. */
const JOB_MARGIN_MS = 60_000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Steps 1-3 of the pipeline. The keyword filter runs BEFORE the insert, so
 * every row lands with its final status (queued / filtered) in one write and
 * nothing can be stranded in "new". Duplicates are dropped by the unique
 * index (ON CONFLICT DO NOTHING), so only newly inserted rows come back.
 */
export async function ingest(platform: Platform, raws: RawItem[], cfg: Config): Promise<IngestResult> {
  if (raws.length === 0) return { fetched: 0, stored: 0, duplicates: 0, filtered_out: 0, queued: 0, queuedIds: [] };

  const byId = new Map<string, RawItem>();
  for (const r of raws) if (!byId.has(r.externalId)) byId.set(r.externalId, r);
  const inBatchDupes = raws.length - byId.size;

  const rules = { allow: cfg.keywords_allow, block: cfg.keywords_block };
  const nowIso = new Date().toISOString();
  const rows = [...byId.values()].map((r) => {
    const f = prefilter({ title: r.title, body: r.body, postedAt: r.postedAt }, rules);
    const videoId = r.meta?.video_id;
    return {
      platform,
      source_kind: r.sourceKind,
      external_id: r.externalId,
      url: r.url,
      community: r.community,
      title: r.title,
      body: r.body,
      posted_at: r.postedAt,
      meta: r.meta ?? {},
      video_id: typeof videoId === "string" ? videoId : null,
      last_seen_at: nowIso,
      status: f.pass ? "queued" : "filtered",
      filter_reason: f.pass ? null : f.reason,
    };
  });

  const inserted: Array<Pick<ItemRow, "id" | "status">> = [];
  for (const part of chunk(rows, 200)) {
    const res = await db()
      .from("items")
      .upsert(part, { onConflict: "platform,external_id", ignoreDuplicates: true })
      .select("id, status");
    if (res.error) throw new Error(`store items: ${res.error.message}`);
    inserted.push(...((res.data ?? []) as typeof inserted));
    // YouTube returned these comments again: the 30-day clock restarts for the
    // ones we already had (the upsert above ignored them).
    if ((res.data?.length ?? 0) < part.length) {
      const seen = await db()
        .from("items")
        .update({ last_seen_at: nowIso })
        .eq("platform", platform)
        .in("external_id", part.map((r) => r.external_id));
      if (seen.error) throw new Error(`refresh last_seen_at: ${seen.error.message}`);
    }
  }

  const queuedIds = inserted.filter((i) => i.status === "queued").map((i) => i.id);
  await enqueueMany(JOB_TYPES.classify, queuedIds.map((item_id) => ({ item_id })));

  return {
    fetched: raws.length,
    stored: inserted.length,
    duplicates: inBatchDupes + (rows.length - inserted.length),
    filtered_out: inserted.length - queuedIds.length,
    queued: queuedIds.length,
    queuedIds,
  };
}

async function startRun(platform: Platform, trigger: RunRow["trigger"], job = "collect"): Promise<RunRow> {
  return must(await db().from("runs").insert({ platform, trigger, job }).select("*").single(), "start run") as RunRow;
}

async function finishRun(id: string, patch: Partial<RunRow>): Promise<RunRow> {
  return must(
    await db()
      .from("runs")
      .update({ ...patch, finished_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single(),
    "finish run",
  ) as RunRow;
}

function countTagged(queuedIds: string[], processedIds: string[]): number {
  const mine = new Set(queuedIds);
  return processedIds.filter((id) => mine.has(id)).length;
}

/** Automatic collection for one platform, recorded as a run. */
export async function collectPlatform(platform: Platform, trigger: RunRow["trigger"], budgetMs = 120_000): Promise<RunRow> {
  const started = Date.now();
  const run = await startRun(platform, trigger);
  try {
    const collector = COLLECTORS[platform];
    if (!collector) throw new CollectorConfigError("This platform has no automatic collector.");
    const cfg = config();
    const { items, notes, commit } = await collector({ config: cfg, now: new Date() });
    const { queuedIds, ...counts } = await ingest(platform, items, cfg);
    // Only now that the comments are stored may the collector move its cursors.
    if (commit) await commit();
    const remaining = budgetMs - (Date.now() - started);
    const drained = await drainJobs(remaining);
    return finishRun(run.id, {
      status: "ok",
      ...counts,
      tagged: countTagged(queuedIds, drained.processedItemIds),
      notes: { ...notes, jobs_processed: drained.processed, jobs_failed: drained.failed },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return finishRun(run.id, { status: e instanceof CollectorConfigError ? "skipped" : "error", error: message.slice(0, 2000) });
  }
}

/**
 * Any other scheduled job (sweep, discover, channels, coverage, cleanup),
 * recorded as a run so the YouTube page shows it. `work` returns the notes to
 * store; a CollectorConfigError (missing key) records "skipped", anything else "error".
 */
export async function runJob(job: string, work: () => Promise<Record<string, unknown>>): Promise<RunRow> {
  const run = await startRun("youtube", "cron", job);
  try {
    const notes = await work();
    return finishRun(run.id, { status: "ok", notes });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return finishRun(run.id, { status: e instanceof CollectorConfigError ? "skipped" : "error", error: message.slice(0, 2000) });
  }
}

/** Step 4-5 for one queued item: tag it with AI, score it, set its status. Returns the item id if work was done. */
async function processClassifyJob(job: JobRow): Promise<string | null> {
  const itemId = String(job.payload.item_id ?? "");
  if (!itemId) return null;
  const res = await db().from("items").select("*").eq("id", itemId).maybeSingle();
  if (res.error) throw new Error(`load item: ${res.error.message}`);
  const item = res.data as ItemRow | null;
  if (!item || item.status !== "queued") return null; // deleted or already handled: idempotent

  const { classification: answered, model } = await classify(item);
  // Rule check on the AI's answer (e.g. "which is better, sugar or jaggery?"
  // tagged as an app comparison). `raw` keeps what the model actually said.
  const classification = applyIntentGuards(answered, itemText(item));

  const tagRes = await db()
    .from("tags")
    .upsert({ item_id: item.id, ...classification, model, raw: answered }, { onConflict: "item_id" });
  if (tagRes.error) throw new Error(`save tags: ${tagRes.error.message}`);

  let status: ItemRow["status"] = "tagged";
  let filter_reason: string | null = null;
  let s: number | null = score({ classification, postedAt: item.posted_at });
  if (classification.do_not_reply) {
    status = "do_not_reply";
    s = null;
  } else if (classification.intent === "irrelevant") {
    status = "filtered";
    filter_reason = "ai:irrelevant";
    s = null;
  }
  const up = await db().from("items").update({ status, filter_reason, score: s }).eq("id", item.id);
  if (up.error) throw new Error(`update item: ${up.error.message}`);
  return item.id;
}

/**
 * Items marked "queued" whose classify job was lost (e.g. an enqueue that
 * failed after the insert) get a fresh job. Cheap; runs before every drain.
 */
export async function requeueOrphans(): Promise<number> {
  const queued = await db().from("items").select("id").eq("status", "queued").limit(500);
  if (queued.error) throw new Error(`requeueOrphans items: ${queued.error.message}`);
  const ids = (queued.data ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;
  const jobs = await db()
    .from("jobs")
    .select("payload")
    .eq("type", JOB_TYPES.classify)
    .in("status", ["pending", "running"])
    .in("payload->>item_id", ids);
  if (jobs.error) throw new Error(`requeueOrphans jobs: ${jobs.error.message}`);
  const covered = new Set((jobs.data ?? []).map((j) => String((j.payload as { item_id?: string })?.item_id ?? "")));
  const missing = ids.filter((id) => !covered.has(id));
  if (missing.length === 0) return 0;
  // Drop the exhausted "failed" rows for these items so the failure counter
  // reflects the retry, not the past (e.g. after fixing a wrong model name).
  const stale = await db()
    .from("jobs")
    .select("id,payload")
    .eq("type", JOB_TYPES.classify)
    .eq("status", "failed")
    .in("payload->>item_id", missing);
  if (stale.error) throw new Error(`requeueOrphans failed jobs: ${stale.error.message}`);
  const missingSet = new Set(missing);
  const staleIds = (stale.data ?? [])
    .filter((j) => missingSet.has(String((j.payload as { item_id?: string })?.item_id ?? "")))
    .map((j) => j.id as number);
  if (staleIds.length) {
    const del = await db().from("jobs").delete().in("id", staleIds);
    if (del.error) throw new Error(`requeueOrphans delete: ${del.error.message}`);
  }
  await enqueueMany(JOB_TYPES.classify, missing.map((item_id) => ({ item_id })));
  return missing.length;
}

function itemText(item: Pick<ItemRow, "title" | "body">): string {
  return `${item.title ?? ""}
${item.body ?? ""}`;
}

/**
 * One-off repair (route /api/cron/retag): re-applies the intent guards to
 * every listed comment currently tagged as an app request or an app complaint
 * and re-scores the ones the guard changes. Idempotent.
 */
export async function retagGuarded(now = new Date()): Promise<{ checked: number; changed: number }> {
  const tags = await db().from("tags").select("*").in("intent", ["app_recommendation", "competitor_complaint"]).limit(5000);
  if (tags.error) throw new Error(`retag tags: ${tags.error.message}`);
  const rows = (tags.data ?? []) as TagRow[];
  if (rows.length === 0) return { checked: 0, changed: 0 };

  const items = await db().from("items").select("id, title, body, posted_at, status").in("id", rows.map((t) => t.item_id)).eq("status", "tagged");
  if (items.error) throw new Error(`retag items: ${items.error.message}`);
  const itemBy = new Map((items.data as Array<Pick<ItemRow, "id" | "title" | "body" | "posted_at" | "status">>).map((i) => [i.id, i]));

  let checked = 0;
  let changed = 0;
  for (const t of rows) {
    const item = itemBy.get(t.item_id);
    if (!item) continue;
    checked++;
    const fixed = applyIntentGuards(t, itemText(item));
    if (fixed === t) continue;
    const upTag = await db()
      .from("tags")
      .update({ intent: fixed.intent, competitor: fixed.competitor, fit_score: fixed.fit_score })
      .eq("item_id", t.item_id);
    if (upTag.error) throw new Error(`retag update tag: ${upTag.error.message}`);
    const upItem = await db()
      .from("items")
      .update({ score: score({ classification: fixed, postedAt: item.posted_at, now }) })
      .eq("id", t.item_id)
      .eq("status", "tagged");
    if (upItem.error) throw new Error(`retag update item: ${upItem.error.message}`);
    changed++;
  }
  return { checked, changed };
}

/** How far back rescoring looks: the decay is capped at 14 points (7 days), so older scores are already final. */
const RESCORE_WINDOW_DAYS = 9;

/**
 * The score includes a freshness penalty (2 points per full day since the
 * comment was posted, at most 14). A score saved at tagging time would freeze
 * that penalty, so a week-old comment would keep its day-one score. This
 * recomputes the score of every listed comment posted in the last 9 days with
 * the same score() function and saves only the ones that changed. Runs before
 * every drain (hourly), so the Score order is never more than an hour stale.
 */
export async function rescoreTagged(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - RESCORE_WINDOW_DAYS * 86_400_000).toISOString();
  const items = await db()
    .from("items")
    .select("id, posted_at, score")
    .eq("status", "tagged")
    .gte("posted_at", since)
    .limit(1000);
  if (items.error) throw new Error(`rescore items: ${items.error.message}`);
  const rows = (items.data ?? []) as Array<Pick<ItemRow, "id" | "posted_at" | "score">>;
  if (rows.length === 0) return 0;

  const tags = await db().from("tags").select("*").in("item_id", rows.map((r) => r.id));
  if (tags.error) throw new Error(`rescore tags: ${tags.error.message}`);
  const tagBy = new Map((tags.data as TagRow[]).map((t) => [t.item_id, t]));

  let changed = 0;
  for (const r of rows) {
    const t = tagBy.get(r.id);
    if (!t) continue;
    const s = score({ classification: t, postedAt: r.posted_at, now });
    if (r.score !== null && Math.abs(Number(r.score) - s) < 0.005) continue;
    const up = await db().from("items").update({ score: s }).eq("id", r.id).eq("status", "tagged");
    if (up.error) throw new Error(`rescore update: ${up.error.message}`);
    changed++;
  }
  return changed;
}

/**
 * Work through pending classify jobs one at a time until the queue is empty
 * or there is no longer room for one more job before the deadline. Claiming
 * one job per loop means nothing is left locked when we stop.
 */
export async function drainJobs(budgetMs: number): Promise<{ processed: number; failed: number; processedItemIds: string[] }> {
  const deadline = Date.now() + budgetMs;
  const processedItemIds: string[] = [];
  let processed = 0;
  let failed = 0;
  await releaseStale();
  await requeueOrphans();
  await rescoreTagged();
  while (Date.now() + JOB_MARGIN_MS < deadline) {
    const [job] = await claim(1, [JOB_TYPES.classify]);
    if (!job) break;
    try {
      const id = await processClassifyJob(job);
      await complete(job.id);
      processed++;
      if (id) processedItemIds.push(id);
    } catch (e) {
      if (e instanceof AllKeysParkedError) {
        // Not this job's fault. Hand it back untouched and stop; the next
        // cron run picks the queue up again.
        await defer(job, e.retryInMs, e.message);
        break;
      }
      await fail(job, e);
      failed++;
    }
  }
  return { processed, failed, processedItemIds };
}

/**
 * Job 7 · Cleanup. Items YouTube has not returned for `retentionDays` are
 * deleted (tags cascade); so are non-active videos and unfollowed channels not
 * seen for that long (a watched video is refreshed by every count check).
 * Channels with no on-topic upload for YT.unfollow_after_days stop being
 * listed daily. Old runs and finished jobs go too.
 */
export async function cleanup(retentionDays: number): Promise<Record<string, number>> {
  const now = Date.now();
  const cutoff = new Date(now - retentionDays * 86_400_000).toISOString();
  const items = await db().from("items").delete().lt("last_seen_at", cutoff).select("id");
  if (items.error) throw new Error(`cleanup items: ${items.error.message}`);
  const runs = await db().from("runs").delete().lt("started_at", new Date(now - 60 * 86_400_000).toISOString()).select("id");
  if (runs.error) throw new Error(`cleanup runs: ${runs.error.message}`);
  const jobs = await db().from("jobs").delete().in("status", ["done", "failed"]).lt("updated_at", cutoff).select("id");
  if (jobs.error) throw new Error(`cleanup jobs: ${jobs.error.message}`);

  const unfollowBefore = new Date(now - YT.unfollow_after_days * 86_400_000).toISOString();
  const unfollowed = await db()
    .from("channels")
    .update({ followed: false })
    .eq("followed", true)
    .lt("first_seen_at", unfollowBefore)
    .or(`last_on_topic_at.is.null,last_on_topic_at.lt.${unfollowBefore}`)
    .select("channel_id");
  if (unfollowed.error) throw new Error(`cleanup unfollow: ${unfollowed.error.message}`);
  // Removed or private videos are deleted. Retired and comments-off videos keep
  // their id (so channel checks and the coverage check do not count them as
  // missing and add them back), but their YouTube data is cleared at 30 days.
  const videos = await db().from("videos").delete().lt("last_seen_at", cutoff).eq("status", "gone").select("video_id");
  if (videos.error) throw new Error(`cleanup videos: ${videos.error.message}`);
  const stripped = await db()
    .from("videos")
    .update({ title: null, channel_title: null, comment_count: null, duration_seconds: null })
    .lt("last_seen_at", cutoff)
    .in("status", ["retired", "comments_disabled"])
    .not("title", "is", null)
    .select("video_id");
  if (stripped.error) throw new Error(`cleanup strip videos: ${stripped.error.message}`);
  const channels = await db().from("channels").delete().lt("last_seen_at", cutoff).eq("followed", false).select("channel_id");
  if (channels.error) throw new Error(`cleanup channels: ${channels.error.message}`);
  const yieldRes = await db().rpc("refresh_video_yield");
  if (yieldRes.error) throw new Error(`refresh_video_yield: ${yieldRes.error.message}`);

  return {
    items: items.data?.length ?? 0,
    runs: runs.data?.length ?? 0,
    jobs: jobs.data?.length ?? 0,
    videos: videos.data?.length ?? 0,
    videos_cleared: stripped.data?.length ?? 0,
    channels: channels.data?.length ?? 0,
    unfollowed: unfollowed.data?.length ?? 0,
  };
}
