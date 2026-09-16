"use client";

import { useActionState, useState, useTransition } from "react";
import { processQueueNow, runPlatformNow, submitPost, type ActionState } from "@/app/actions";
import { cx } from "@/lib/format";
import type { Platform } from "@/lib/types";

function Message({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <p className={cx("mt-2 rounded-md px-3 py-2 text-sm", state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900")}>{state.message}</p>
  );
}

const input = "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm";
const label = "block text-xs font-semibold text-stone-700";
const button = "rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50";

export function RunNowForm({ platform }: { platform: Platform }) {
  const [state, action, pending] = useActionState(runPlatformNow, null);
  return (
    <form action={action}>
      <input type="hidden" name="platform" value={platform} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Collecting… this can take a minute" : "Run collection now"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ProcessQueueButton({ pendingJobs }: { pendingJobs: number }) {
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  if (pendingJobs === 0) return null;
  return (
    <div>
      <button
        disabled={pending}
        onClick={() => start(async () => setState(await processQueueNow()))}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {pending ? "Tagging…" : `Tag ${pendingJobs} waiting item(s) now`}
      </button>
      <Message state={state} />
    </div>
  );
}

export function PostForm({ platform, hint }: { platform: Platform; hint: string }) {
  const [state, action, pending] = useActionState(submitPost, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="platform" value={platform} />
      <p className="text-sm text-stone-600">{hint}</p>
      <div>
        <label className={label}>Link to the post</label>
        <input name="url" type="url" placeholder="https://www.reddit.com/r/diabetes/comments/…" className={input} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Community (optional, e.g. r/PCOS)</label>
          <input name="community" className={input} />
        </div>
        <div>
          <label className={label}>Posted on (optional)</label>
          <input name="posted_at" type="date" className={input} />
        </div>
      </div>
      <div>
        <label className={label}>Title</label>
        <input name="title" className={input} />
      </div>
      <div>
        <label className={label}>Text of the post</label>
        <textarea name="body" rows={5} className={input} placeholder="Paste the post text. Leave out the username." />
      </div>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving and tagging…" : "Add to queue"}
      </button>
      <Message state={state} />
    </form>
  );
}
