import { after, type NextRequest } from "next/server";
import { isCronAuthorized, unauthorized } from "@/lib/cron-auth";
import { drainJobs } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tags whatever is still waiting in the queue (e.g. after an AI rate limit).
 * Answers at once and works in the background; `?wait=1` runs inline.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorized();

  if (request.nextUrl.searchParams.get("wait") === "1") {
    return Response.json({ ok: true, ...(await drainJobs(270_000)) });
  }
  after(async () => {
    try {
      await drainJobs(270_000);
    } catch (e) {
      console.error("cron/process failed", e);
    }
  });
  return Response.json({ ok: true, started: true }, { status: 202 });
}
