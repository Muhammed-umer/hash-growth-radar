import { after, type NextRequest } from "next/server";
import { isCronAuthorized, unauthorized } from "@/lib/cron-auth";
import { collectPlatform } from "@/lib/pipeline/run";
import { getSettings } from "@/lib/settings";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby maximum with Fluid Compute

/**
 * Runs every automatic collector, then tags what it can within the time budget.
 *
 * Supabase Cron calls this on a schedule (supabase/migrations/0002_cron.sql).
 * Its HTTP client waits only a few seconds, so by default we answer "started"
 * at once and do the work after the response is sent (Next.js `after()`), which
 * still gets the full maxDuration. Add `?wait=1` to run inline and get the
 * result back, e.g. when calling by hand:
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/collect?wait=1"
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorized();

  const work = async () => {
    const settings = await getSettings();
    const platforms: Platform[] = ["youtube"];
    if (settings.reddit_api_enabled) platforms.push("reddit");
    const perPlatform = Math.floor(270_000 / platforms.length);
    const results = [];
    for (const p of platforms) {
      const run = await collectPlatform(p, "cron", perPlatform);
      results.push({
        platform: p,
        status: run.status,
        fetched: run.fetched,
        stored: run.stored,
        filtered_out: run.filtered_out,
        queued: run.queued,
        tagged: run.tagged,
        error: run.error,
      });
    }
    return results;
  };

  if (request.nextUrl.searchParams.get("wait") === "1") {
    return Response.json({ ok: true, results: await work() });
  }
  after(async () => {
    try {
      await work();
    } catch (e) {
      console.error("cron/collect failed", e);
    }
  });
  return Response.json({ ok: true, started: true }, { status: 202 });
}
