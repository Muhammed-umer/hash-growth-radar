import { YT } from "@/lib/config";
import { cronHandler } from "@/lib/cron-route";
import { runJob } from "@/lib/pipeline/run";
import { youtubeContext } from "@/lib/youtube/client";
import { runCoverage } from "@/lib/youtube/coverage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Job 8 · Weekly: compare a sample of followed channels' real upload lists with the watch list. */
export const GET = cronHandler("coverage", () => runJob("coverage", () => runCoverage(youtubeContext(), { timeBudgetMs: YT.job_time_budget_ms })));
