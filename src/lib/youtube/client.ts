import "server-only";
import { YT } from "../config";
import { db } from "../db";
import { env } from "../env";
import { CollectorConfigError } from "../collectors/types";
import { createYouTubeClient, type YouTubeClient } from "./api";
import { Ledger, quotaDay, type QuotaTotals } from "./quota";

/** The ledger backed by the quota_ledger table (spend_quota RPC, atomic). */
export function dbLedger(clock?: () => Date): Ledger {
  return new Ledger(
    async (day, searches, units) => {
      const res = await db().rpc("spend_quota", { p_day: day, p_searches: searches, p_units: units });
      if (res.error) throw new Error(`spend_quota: ${res.error.message}`);
      const row = (Array.isArray(res.data) ? res.data[0] : res.data) as { searches: number; units: number } | undefined;
      return { searches: Number(row?.searches ?? 0), units: Number(row?.units ?? 0) };
    },
    YT.ledger_caps,
    clock,
  );
}

/** Today's totals without spending anything (for the YouTube page). */
export async function quotaToday(now = new Date()): Promise<QuotaTotals & { day: string }> {
  const day = quotaDay(now);
  const res = await db().from("quota_ledger").select("searches, units").eq("quota_day", day).maybeSingle();
  if (res.error) throw new Error(`quota_ledger: ${res.error.message}`);
  return { day, searches: Number(res.data?.searches ?? 0), units: Number(res.data?.units ?? 0) };
}

export interface YouTubeContext {
  client: YouTubeClient;
  ledger: Ledger;
  now: Date;
}

/** The real client, or a CollectorConfigError (run recorded as "skipped") when the key is missing. */
export function youtubeContext(now = new Date()): YouTubeContext {
  const key = env("YOUTUBE_API_KEY");
  if (!key) {
    throw new CollectorConfigError(
      "YOUTUBE_API_KEY is not set. Create a key in Google Cloud console (APIs & Services → Credentials) with the YouTube Data API v3 enabled.",
    );
  }
  const ledger = dbLedger(() => new Date());
  return { client: createYouTubeClient({ apiKey: key, ledger }), ledger, now };
}
