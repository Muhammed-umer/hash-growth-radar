"use client";

import { useState, useTransition } from "react";
import { skipItem } from "@/app/actions";
import { PLATFORM_INFO } from "@/lib/config";
import { cx, INTENT_LABEL } from "@/lib/format";
import type { ItemRow, TagRow } from "@/lib/types";

export interface ItemCardProps {
  item: ItemRow;
  tag: TagRow | null;
  postedLabel: string;
  showPlatform?: boolean;
}

/**
 * One person worth approaching: where they asked, what they asked, the AI's
 * tags, and the score the list is sorted by. No reply is suggested; you open
 * the thread and decide yourself, then Skip the card when you are done with it.
 */
export function ItemCard({ item, tag, postedLabel, showPlatform }: ItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

  function skip() {
    setSkipError(null);
    setLeaving(true);
    start(async () => {
      try {
        await skipItem(item.id);
      } catch (e) {
        // Put the card back and say why.
        setLeaving(false);
        setSkipError(e instanceof Error ? e.message : "Could not skip. Try again.");
      }
    });
  }

  const info = PLATFORM_INFO[item.platform];
  const videoTitle = typeof item.meta?.video_title === "string" ? item.meta.video_title : null;

  async function copyLink() {
    if (!item.url) return;
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        leaving ? "pointer-events-none grid-rows-[0fr] scale-[0.98] opacity-0" : "grid-rows-[1fr] opacity-100",
      )}
      aria-hidden={leaving}
    >
    <div className="min-h-0 overflow-hidden">
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
        {showPlatform && <span className="rounded-full bg-stone-900 px-2 py-0.5 text-white">{info.label}</span>}
        {item.community && <span className="rounded-full bg-stone-100 px-2 py-0.5">{item.community}</span>}
        <span>{postedLabel}</span>
        {typeof item.score === "number" && (
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">score {Math.round(item.score)}</span>
        )}
      </div>

      {item.title && <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>}
      {videoTitle && <p className="mt-1 text-xs text-stone-500">Under the video: {videoTitle}</p>}
      {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{item.body.length > 900 ? `${item.body.slice(0, 900)}…` : item.body}</p>}

      {tag && (
        <div className="mt-3 rounded-lg bg-stone-50 p-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="dark">{INTENT_LABEL[tag.intent] ?? tag.intent}</Chip>
            {tag.medicines.map((m) => (
              <Chip key={`m-${m}`} tone="blue">
                {m}
              </Chip>
            ))}
            {tag.conditions.map((c) => (
              <Chip key={`c-${c}`} tone="violet">
                {c}
              </Chip>
            ))}
            {tag.competitor && <Chip tone="amber">vs {tag.competitor}</Chip>}
            {tag.language !== "en" && <Chip>{tag.language}</Chip>}
            {tag.urgency !== "low" && <Chip tone="amber">{tag.urgency} urgency</Chip>}
          </div>
          {tag.summary && <p className="mt-2 text-stone-700">{tag.summary}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-white transition-colors hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Open thread
          </a>
        )}
        {item.url && (
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-stone-300 px-3 py-1.5 transition-colors hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
        {skipError && <span className="text-xs text-red-700">{skipError}</span>}
        <button
          type="button"
          disabled={pending || leaving}
          onClick={skip}
          className="ml-auto rounded-md px-3 py-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
          title="Hide this card, whether you approached the person or not."
        >
          Skip
        </button>
      </div>
    </article>
    </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "dark" | "blue" | "violet" | "amber" }) {
  const cls =
    tone === "dark"
      ? "bg-stone-900 text-white"
      : tone === "blue"
        ? "bg-sky-100 text-sky-900"
        : tone === "violet"
          ? "bg-violet-100 text-violet-900"
          : tone === "amber"
            ? "bg-amber-100 text-amber-900"
            : "bg-white border border-stone-200 text-stone-700";
  return <span className={cx("rounded-full px-2 py-0.5", cls)}>{children}</span>;
}
