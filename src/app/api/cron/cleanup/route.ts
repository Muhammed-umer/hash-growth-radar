import type { NextRequest } from "next/server";
import { RETENTION_DAYS } from "@/lib/config";
import { isCronAuthorized, unauthorized } from "@/lib/cron-auth";
import { cleanup, runJob } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Job 7 · Deletes items not seen for RETENTION_DAYS (YouTube's 30-day rule),
 * aged-out videos and channels, old runs and finished jobs; unfollows quiet
 * channels. Fast enough to run inline; the cron caller gets the counts.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorized();
  const run = await runJob("cleanup", () => cleanup(RETENTION_DAYS));
  return Response.json({ ok: run.status === "ok", status: run.status, deleted: run.notes, error: run.error });
}
