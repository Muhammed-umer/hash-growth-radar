import { cronHandler } from "@/lib/cron-route";
import { runJob } from "@/lib/pipeline/run";
import { youtubeContext } from "@/lib/youtube/client";
import { runDiscover } from "@/lib/youtube/discover";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Jobs 2 + 3 · "Newest since last look" per phrase every 6 hours, plus one relevance search a day. */
export const GET = cronHandler("discover", () => runJob("discover", () => runDiscover(youtubeContext())));
