import { runReader } from "../youtube/reader";
import { youtubeContext } from "../youtube/client";
import type { Collector } from "./types";

/**
 * The "collect" run for YouTube = job 6, the comment reader
 * (src/lib/youtube/reader.ts, docs/coverage-plan.html section 6). It reads
 * new comments from the videos in the watch list; finding videos is the work
 * of the sweep, discover and channels jobs. Authors are never read or stored.
 */
export const collectYouTube: Collector = async ({ now }) => runReader(youtubeContext(now));

// The reader's time budget (YT.reader_time_budget_ms) leaves room inside the
// collect route's 300 s for storing the comments, committing the cursors and
// tagging.
