import "server-only";
import { db, must } from "./db";
import type { JobRow } from "./types";

export const JOB_TYPES = {
  classify: "classify",
} as const;
export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/**
 * A small queue on top of Postgres. Jobs are claimed atomically by the
 * claim_jobs() function (FOR UPDATE SKIP LOCKED), so two cron invocations
 * never process the same job twice.
 */
export async function enqueueMany(type: JobType, payloads: Record<string, unknown>[]): Promise<number> {
  if (payloads.length === 0) return 0;
  const res = await db()
    .from("jobs")
    .insert(payloads.map((payload) => ({ type, payload })));
  if (res.error) throw new Error(`enqueueMany ${type}: ${res.error.message}`);
  return payloads.length;
}

export async function claim(limit: number, types?: JobType[]): Promise<JobRow[]> {
  const res = await db().rpc("claim_jobs", { p_limit: limit, p_types: types ?? null });
  return must(res, "claim_jobs") as JobRow[];
}

export async function complete(id: number): Promise<void> {
  const res = await db()
    .from("jobs")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (res.error) throw new Error(`complete job ${id}: ${res.error.message}`);
}

/** Mark a job failed; retry with exponential backoff until max_attempts. */
export async function fail(job: JobRow, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const exhausted = job.attempts >= job.max_attempts;
  const backoffMinutes = Math.min(60, 2 ** job.attempts);
  const res = await db()
    .from("jobs")
    .update({
      status: exhausted ? "failed" : "pending",
      last_error: message.slice(0, 2000),
      run_after: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (res.error) throw new Error(`fail job ${job.id}: ${res.error.message}`);
}

/**
 * Put a claimed job back without spending an attempt: the provider was
 * unavailable (every AI key parked), which says nothing about this job.
 */
export async function defer(job: JobRow, ms: number, reason: string): Promise<void> {
  const res = await db()
    .from("jobs")
    .update({
      status: "pending",
      attempts: Math.max(0, job.attempts - 1),
      last_error: reason.slice(0, 2000),
      run_after: new Date(Date.now() + ms).toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  if (res.error) throw new Error(`defer job ${job.id}: ${res.error.message}`);
}

/** Jobs stuck in 'running' for over 15 minutes (a crashed function) go back to pending. */
export async function releaseStale(): Promise<number> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const res = await db()
    .from("jobs")
    .update({ status: "pending", locked_at: null, updated_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("locked_at", cutoff)
    .select("id");
  if (res.error) throw new Error(`releaseStale: ${res.error.message}`);
  return res.data?.length ?? 0;
}
