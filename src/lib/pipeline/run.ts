import "server-only";
import { COLLECTORS, CollectorConfigError } from "../collectors";
import type { SettingsShape } from "../config";
import { db, must } from "../db";
import { AllKeysParkedError } from "../ai/keyring";
import { claim, complete, defer, enqueueMany, fail, JOB_TYPES, releaseStale } from "../queue";
import { getSettings } from "../settings";
import type { ItemRow, JobRow, Platform, RawItem, RunRow } from "../types";
import { classify } from "./classify";
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
export async function ingest(platform: Platform, raws: RawItem[], settings: SettingsShape): Promise<IngestResult> {
  if (raws.length === 0) return { fetched: 0, stored: 0, duplicates: 0, filtered_out: 0, queued: 0, queuedIds: [] };

  const byId = new Map<string, RawItem>();
  for (const r of raws) if (!byId.has(r.externalId)) byId.set(r.externalId, r);
  const inBatchDupes = raws.length - byId.size;

  const rules = { allow: settings.keywords_allow, block: settings.keywords_block };
  const rows = [...byId.values()].map((r) => {
    const f = prefilter({ platform, title: r.title, body: r.body, postedAt: r.postedAt }, rules);
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

async function startRun(platform: Platform, trigger: RunRow["trigger"]): Promise<RunRow> {
  return must(await db().from("runs").insert({ platform, trigger }).select("*").single(), "start run") as RunRow;
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
    if (!collector) throw new CollectorConfigError("This platform has no automatic collector. Use the paste form.");
    const settings = await getSettings();
    const { items, notes } = await collector({ settings, now: new Date() });
    const { queuedIds, ...counts } = await ingest(platform, items, settings);
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

/** Manual paste for one platform, recorded as a run so the platform page shows it. */
export async function intake(platform: Platform, raws: RawItem[], budgetMs = 120_000): Promise<RunRow> {
  const run = await startRun(platform, "intake");
  try {
    const settings = await getSettings();
    const { queuedIds, ...counts } = await ingest(platform, raws, settings);
    const drained = await drainJobs(budgetMs);
    return finishRun(run.id, {
      status: "ok",
      ...counts,
      tagged: countTagged(queuedIds, drained.processedItemIds),
      notes: { jobs_processed: drained.processed, jobs_failed: drained.failed },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return finishRun(run.id, { status: "error", error: message.slice(0, 2000) });
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

  const { classification, model } = await classify(item);

  const tagRes = await db()
    .from("tags")
    .upsert({ item_id: item.id, ...classification, model, raw: classification }, { onConflict: "item_id" });
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
        // cron run (or the "Tag now" button) picks the queue up again.
        await defer(job, e.retryInMs, e.message);
        break;
      }
      await fail(job, e);
      failed++;
    }
  }
  return { processed, failed, processedItemIds };
}

/** Delete items past the retention window (tags cascade, old runs and finished jobs are cleaned). */
export async function cleanup(retentionDays: number): Promise<{ items: number; runs: number; jobs: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const items = await db().from("items").delete().lt("collected_at", cutoff).select("id");
  if (items.error) throw new Error(`cleanup items: ${items.error.message}`);
  const runs = await db().from("runs").delete().lt("started_at", new Date(Date.now() - 60 * 86_400_000).toISOString()).select("id");
  if (runs.error) throw new Error(`cleanup runs: ${runs.error.message}`);
  const jobs = await db().from("jobs").delete().in("status", ["done", "failed"]).lt("updated_at", cutoff).select("id");
  if (jobs.error) throw new Error(`cleanup jobs: ${jobs.error.message}`);
  return { items: items.data?.length ?? 0, runs: runs.data?.length ?? 0, jobs: jobs.data?.length ?? 0 };
}
