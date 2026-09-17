import { YT } from "@/lib/config";
import { cronHandler } from "@/lib/cron-route";
import { runJob } from "@/lib/pipeline/run";
import { runChannels } from "@/lib/youtube/channels";
import { youtubeContext } from "@/lib/youtube/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Job 4 · Followed channels: uploads playlist ids, one full history walk, then the newest page daily. */
export const GET = cronHandler("channels", () => runJob("channels", () => runChannels(youtubeContext(), { timeBudgetMs: YT.job_time_budget_ms })));
