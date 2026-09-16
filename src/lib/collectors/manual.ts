import { manualExternalId, redditIdFromUrl, subredditFromUrl } from "../pipeline/ids";
import type { Platform, RawItem } from "../types";

export interface ManualPostInput {
  platform: Platform;
  url: string | null;
  community: string | null;
  title: string | null;
  body: string | null;
  postedAt: string | null;
}

/** One pasted post (Reddit today; anything else later) → one item. */
export function manualPost(input: ManualPostInput): RawItem {
  const url = input.url?.trim() || null;
  let externalId = manualExternalId(url, input.title, input.body);
  let community = input.community?.trim() || null;

  if (input.platform === "reddit" && url) {
    const id = redditIdFromUrl(url);
    if (id) externalId = id; // same id the automatic collector would use, so the two never duplicate
    const sub = subredditFromUrl(url);
    if (!community && sub) community = `r/${sub}`;
  }

  return {
    platform: input.platform,
    sourceKind: "manual",
    externalId,
    url,
    community,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    postedAt: input.postedAt,
    meta: {},
  };
}
