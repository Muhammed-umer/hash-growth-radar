"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { manualPost } from "@/lib/collectors/manual";
import { PLATFORM_INFO, type SettingsShape } from "@/lib/config";
import { db } from "@/lib/db";
import { collectPlatform, drainJobs, intake } from "@/lib/pipeline/run";
import { parseLines, saveSettings } from "@/lib/settings";
import { PLATFORMS, type Platform, type RunRow } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/", "layout");
}

function asPlatform(v: unknown): Platform {
  if (typeof v === "string" && (PLATFORMS as readonly string[]).includes(v)) return v as Platform;
  throw new Error(`Unknown platform: ${String(v)}`);
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** A date from the form as ISO, or now when missing or unparseable. */
function isoDate(fd: FormData, key: string): string {
  const v = str(fd, key);
  const t = v ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

export interface ActionState {
  ok: boolean;
  message: string;
  run?: RunRow;
}

// ---------------------------------------------------------------------------
// Item actions: the list is for finding people. Two ways to clear a card.
// ---------------------------------------------------------------------------

/** Not a fit, or not interested. Hidden from the list. */
export async function skipItem(id: string): Promise<void> {
  await requireUser();
  const res = await db().from("items").update({ status: "skipped" }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}

/**
 * You reached out to this person yourself. Nothing about what you said is
 * stored; the item just leaves the list and counts as "approached".
 * (Kept in the database under the status name "posted".)
 */
export async function markApproached(id: string): Promise<void> {
  await requireUser();
  const res = await db().from("items").update({ status: "posted" }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Collection actions
// ---------------------------------------------------------------------------

export async function runPlatformNow(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireUser();
  const platform = asPlatform(formData.get("platform"));
  const run = await collectPlatform(platform, "manual", 240_000);
  revalidateAll();
  const label = PLATFORM_INFO[platform].label;
  if (run.status === "ok") {
    return {
      ok: true,
      message: `${label}: fetched ${run.fetched}, new ${run.stored}, duplicates ${run.duplicates}, filtered ${run.filtered_out}, queued ${run.queued}, tagged ${run.tagged}.`,
      run,
    };
  }
  return { ok: false, message: `${label}: ${run.status}. ${run.error ?? ""}`, run };
}

export async function processQueueNow(): Promise<ActionState> {
  await requireUser();
  const r = await drainJobs(240_000);
  revalidateAll();
  return { ok: true, message: `Tagged ${r.processed} item(s), ${r.failed} failed (they retry later).` };
}

export async function submitPost(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireUser();
  const platform = asPlatform(formData.get("platform"));
  const url = str(formData, "url");
  const title = str(formData, "title");
  const body = str(formData, "body");
  if (!title && !body) return { ok: false, message: "Paste at least the title or the text of the post." };
  const raw = manualPost({
    platform,
    url,
    community: str(formData, "community"),
    title,
    body,
    postedAt: isoDate(formData, "posted_at"),
  });
  const run = await intake(platform, [raw], 120_000);
  revalidateAll();
  if (run.status !== "ok") return { ok: false, message: run.error ?? "Intake failed", run };
  if (run.duplicates > 0) return { ok: true, message: "Already in the system (same post pasted before).", run };
  if (run.filtered_out > 0) return { ok: true, message: "Saved, but the keyword filter dropped it (no relevant term, or noise). Check the dropped list below.", run };
  return { ok: true, message: run.tagged > 0 ? "Saved and tagged. See the list below." : "Saved and queued for tagging.", run };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveSettingsAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  await requireUser();
  const patch: Partial<SettingsShape> = {};
  const listKeys: Array<keyof SettingsShape> = [
    "youtube_topics",
    "reddit_subreddits",
    "reddit_queries",
    "keywords_allow",
    "keywords_block",
  ];
  for (const k of listKeys) {
    const v = formData.get(k);
    if (typeof v === "string") (patch as Record<string, unknown>)[k] = parseLines(v);
  }
  const numKeys: Array<[keyof SettingsShape, number, number]> = [
    ["youtube_max_searches_per_run", 0, 100],
    ["youtube_videos_per_topic", 1, 50],
    ["youtube_comments_per_video", 1, 100],
  ];
  for (const [k, min, max] of numKeys) {
    const v = formData.get(k);
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (!Number.isFinite(n)) return { ok: false, message: `${k} must be a number` };
      (patch as Record<string, unknown>)[k] = Math.min(max, Math.max(min, Math.floor(n)));
    }
  }
  patch.reddit_api_enabled = formData.get("reddit_api_enabled") === "on";

  await saveSettings(patch);
  revalidateAll();
  return { ok: true, message: "Settings saved." };
}
