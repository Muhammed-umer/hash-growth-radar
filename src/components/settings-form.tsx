"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/actions";
import type { SettingsShape } from "@/lib/config";
import { cx } from "@/lib/format";

const input = "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono";
const label = "block text-xs font-semibold text-stone-700";

function Lines({ name, value, rows = 6, help }: { name: keyof SettingsShape; value: string[]; rows?: number; help: string }) {
  return (
    <div>
      <label className={label}>{help}</label>
      <textarea name={name} rows={rows} defaultValue={value.join("\n")} className={input} />
    </div>
  );
}

export function SettingsForm({ settings }: { settings: SettingsShape }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Lines name="youtube_topics" value={settings.youtube_topics} help="YouTube topics, one per line (each costs 1 of the 100 daily searches)" />
        <Lines name="reddit_subreddits" value={settings.reddit_subreddits} help="Reddit communities to check (without r/), one per line" rows={8} />
        <Lines name="reddit_queries" value={settings.reddit_queries} help="Reddit search phrases, one per line" rows={8} />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>YouTube searches per run</label>
            <input name="youtube_max_searches_per_run" type="number" min={0} max={100} defaultValue={settings.youtube_max_searches_per_run} className={input} />
          </div>
          <div>
            <label className={label}>Videos per topic</label>
            <input name="youtube_videos_per_topic" type="number" min={1} max={50} defaultValue={settings.youtube_videos_per_topic} className={input} />
          </div>
          <div>
            <label className={label}>Comments per video</label>
            <input name="youtube_comments_per_video" type="number" min={1} max={100} defaultValue={settings.youtube_comments_per_video} className={input} />
          </div>
          <label className="col-span-3 mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="reddit_api_enabled" defaultChecked={settings.reddit_api_enabled} />
            Reddit API enabled (only after Reddit approved access and the keys are set)
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Lines name="keywords_allow" value={settings.keywords_allow} rows={14} help="Keyword filter: an item must contain at least one of these (whole word / phrase)" />
        <Lines name="keywords_block" value={settings.keywords_block} rows={14} help="Keyword filter: drop items containing any of these" />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50">
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state && <span className={cx("text-sm", state.ok ? "text-emerald-800" : "text-red-800")}>{state.message}</span>}
      </div>
    </form>
  );
}
