"use client";

import { useState, useTransition } from "react";
import { Check, CirclePlay, Clock, Copy, ExternalLink, EyeOff, Flame, HeartPulse, Languages, MessageCircleQuestion, Pill, Smartphone, Sparkles } from "lucide-react";
import { skipItem } from "@/app/actions";
import { PLATFORM_INFO } from "@/lib/config";
import { cx, INTENT_LABEL } from "@/lib/format";
import type { ItemRow, TagRow } from "@/lib/types";
import { YouTubeIcon } from "./icons";

export interface ItemCardProps {
  item: ItemRow;
  tag: TagRow | null;
  postedLabel: string;
}

/** Colour band of the score: 90+ strong, 70+ good, below that muted. */
function scoreTone(score: number): string {
  if (score >= 90) return "bg-emerald-700 text-white ring-emerald-700";
  if (score >= 70) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return "bg-stone-100 text-stone-600 ring-stone-200";
}

/**
 * One person worth approaching: where they asked, what they asked, the AI's
 * tags, and the score the list is sorted by. No reply is suggested; you open
 * the thread and decide yourself, then Skip the card when you are done with it.
 */
export function ItemCard({ item, tag, postedLabel }: ItemCardProps) {
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
  // community is stored as "YouTube · Channel name"; the icon already says YouTube.
  const channel = item.community?.replace(new RegExp(`^${info.label}\\s*·\\s*`), "") ?? null;
  const score = typeof item.score === "number" ? Math.round(item.score) : null;

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

  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        leaving ? "pointer-events-none grid-rows-[0fr] scale-[0.98] opacity-0" : "grid-rows-[1fr] opacity-100",
      )}
      aria-hidden={leaving}
    >
      <div className="min-h-0 overflow-hidden">
        <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:shadow-md hover:ring-stone-300 sm:p-5">
          <div className="flex gap-4">
            {score !== null && (
              <div
                className={cx("flex size-12 shrink-0 flex-col items-center justify-center rounded-xl ring-1", scoreTone(score))}
                title="Score: fit + question type + urgency − age"
              >
                <span className="text-lg font-bold leading-none tabular-nums">{score}</span>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider opacity-80">score</span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-stone-700">
                  <YouTubeIcon className="size-4 shrink-0" />
                  <span className="truncate">{channel ?? info.label}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {postedLabel}
                </span>
                {tag && tag.urgency !== "low" && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                    <Flame className="size-3.5" aria-hidden />
                    {tag.urgency} urgency
                  </span>
                )}
              </div>

              {videoTitle && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-stone-500">
                  <CirclePlay className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-1">{videoTitle}</span>
                </p>
              )}

              {item.title && <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>}
              {item.body && (
                <p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-900">
                  {item.body.length > 900 ? `${item.body.slice(0, 900)}…` : item.body}
                </p>
              )}

              {tag && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <Chip tone="dark" icon={<MessageCircleQuestion className="size-3.5" aria-hidden />}>
                    {INTENT_LABEL[tag.intent] ?? tag.intent}
                  </Chip>
                  {tag.medicines.map((m) => (
                    <Chip key={`m-${m}`} tone="blue" icon={<Pill className="size-3.5" aria-hidden />}>
                      {m}
                    </Chip>
                  ))}
                  {tag.conditions.map((c) => (
                    <Chip key={`c-${c}`} tone="violet" icon={<HeartPulse className="size-3.5" aria-hidden />}>
                      {c}
                    </Chip>
                  ))}
                  {tag.competitor && (
                    <Chip tone="amber" icon={<Smartphone className="size-3.5" aria-hidden />}>
                      about {tag.competitor}
                    </Chip>
                  )}
                  {tag.language !== "en" && <Chip icon={<Languages className="size-3.5" aria-hidden />}>{tag.language}</Chip>}
                </div>
              )}

              {tag?.summary && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{tag.summary}</span>
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cx("inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 font-medium text-white shadow-sm transition hover:bg-stone-700", focus)}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Open on {info.label}
                  </a>
                )}
                {item.url && (
                  <button
                    type="button"
                    onClick={copyLink}
                    className={cx("inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50", focus)}
                  >
                    {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                )}
                {skipError && <span className="text-xs text-red-700">{skipError}</span>}
                <button
                  type="button"
                  disabled={pending || leaving}
                  onClick={skip}
                  className={cx("ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50", focus)}
                  title="Hide this card, whether you approached the person or not."
                >
                  <EyeOff className="size-4" aria-hidden />
                  Skip
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function Chip({ children, tone, icon }: { children: React.ReactNode; tone?: "dark" | "blue" | "violet" | "amber"; icon?: React.ReactNode }) {
  const cls =
    tone === "dark"
      ? "bg-stone-900 text-white"
      : tone === "blue"
        ? "bg-sky-50 text-sky-900 ring-1 ring-sky-200"
        : tone === "violet"
          ? "bg-violet-50 text-violet-900 ring-1 ring-violet-200"
          : tone === "amber"
            ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            : "bg-white text-stone-700 ring-1 ring-stone-200";
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", cls)}>
      {icon}
      {children}
    </span>
  );
}
