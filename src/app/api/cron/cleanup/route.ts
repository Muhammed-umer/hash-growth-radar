import type { NextRequest } from "next/server";
import { RETENTION_DAYS } from "@/lib/config";
import { isCronAuthorized, unauthorized } from "@/lib/cron-auth";
import { cleanup } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Deletes items older than RETENTION_DAYS (the privacy rule), old runs and
 * finished jobs. Fast enough to run inline; the cron caller gets the counts.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorized();
  const r = await cleanup(RETENTION_DAYS);
  return Response.json({ ok: true, deleted: r });
}
