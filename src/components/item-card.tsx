"use client";

import { useState, useTransition } from "react";
import { markApproached, skipItem } from "@/app/actions";
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
 * One person worth approaching: where they asked, what they asked, and the
 * AI's tags. No reply is suggested; you open the thread and decide yourself.
 */
export function ItemCard({ item, tag, postedLabel, showPlatform }: ItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

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
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
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
            <Chip>fit {tag.fit_score}</Chip>
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
          <a href={item.url} target="_blank" rel="noreferrer" className="rounded-md bg-stone-900 px-3 py-1.5 text-white">
            Open thread
          </a>
        )}
        {item.url && (
          <button onClick={copyLink} className="rounded-md border border-stone-300 px-3 py-1.5">
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => start(() => markApproached(item.id))}
          className="rounded-md border border-emerald-600 px-3 py-1.5 text-emerald-800 disabled:opacity-50"
          title="You reached out to this person. Removes the card from the list."
        >
          Approached
        </button>
        <button
          disabled={pending}
          onClick={() => start(() => skipItem(item.id))}
          className="ml-auto rounded-md px-3 py-1.5 text-stone-500 hover:bg-stone-100"
        >
          Skip
        </button>
      </div>
    </article>
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
