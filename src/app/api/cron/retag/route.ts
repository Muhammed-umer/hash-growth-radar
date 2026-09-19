import type { NextRequest } from "next/server";
import { isCronAuthorized, unauthorized } from "@/lib/cron-auth";
import { retagGuarded, runJob } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-off, not scheduled. Re-applies the intent guards (pipeline/guards.ts)
 * to every listed comment the AI tagged as "asking for an app" or "complaint
 * about an app", and re-scores the ones that change. Safe to run again: a
 * comment the guard leaves alone is untouched. Call by hand:
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/retag"
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorized();
  const run = await runJob("retag", () => retagGuarded());
  return Response.json({ ok: run.status === "ok", status: run.status, result: run.notes, error: run.error });
}
