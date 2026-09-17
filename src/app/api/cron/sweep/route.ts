import { YT } from "@/lib/config";
import { cronHandler } from "@/lib/cron-route";
import { runJob } from "@/lib/pipeline/run";
import { youtubeContext } from "@/lib/youtube/client";
import { runSweep } from "@/lib/youtube/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Job 1 · The one-time month sweep, every 2 hours until every phrase and month is done. */
export const GET = cronHandler("sweep", () => runJob("sweep", () => runSweep(youtubeContext(), { timeBudgetMs: YT.job_time_budget_ms })));
