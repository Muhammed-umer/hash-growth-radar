"use client";

import { useState, useTransition } from "react";
import { Check, CheckCheck, CirclePlay, Clock, Copy, ExternalLink, HeartPulse, Languages, Pill, Sparkles, Undo2 } from "lucide-react";
import { markRead, markUnread } from "@/app/actions";
import { PLATFORM_INFO } from "@/lib/config";
import { cx, LANGUAGE_LABEL, SCORE_BANDS, timeAgo } from "@/lib/format";
import type { ItemRow, TagRow } from "@/lib/types";
import { YouTubeIcon } from "./icons";
import { countsChanged, showToast } from "./toast";

export interface ItemCardProps {
  item: ItemRow;
  tag: TagRow | null;
  postedLabel: string;
  /** "open": on a list, with "Mark as read". "read": on the Read page, with "Move back". */
  mode?: "open" | "read";
}

/** Colour band of the score tile. The "?" help panel explains the same bands. */
function scoreTone(score: number): string {
  if (score >= SCORE_BANDS.strong) return "bg-emerald-700 text-white ring-emerald-700";
  if (score >= SCORE_BANDS.good) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return "bg-stone-100 text-stone-600 ring-stone-200";
}

/**
 * One person worth approaching: where they asked, what they asked, what the
 * question names, and the score the list is sorted by. No reply is suggested;
 * you open the thread and decide yourself, then mark the card as read.
 */
export function ItemCard({ item, tag, postedLabel, mode = "open" }: ItemCardProps) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mark as read (or move back), with Undo in the notice at the bottom.
  function move(toRead: boolean) {
    setError(null);
    setLeaving(true);
    start(async () => {
      try {
        await (toRead ? markRead(item.id) : markUnread(item.id));
        countsChanged();
        showToast({
          message: toRead ? "Marked as read. It is on the Read page." : "Moved back to the list.",
          action: {
            label: "Undo",
            run: () => {
              void (toRead ? markUnread(item.id) : markRead(item.id)).then(countsChanged, () =>
                showToast({ message: "Could not undo. Try again from the Read page." }),
              );
            },
          },
        });
      } catch (e) {
        // Put the card back and say why.
        setLeaving(false);
        setError(e instanceof Error ? e.message : "That did not work. Try again.");
      }
    });
  }

  const info = PLATFORM_INFO[item.platform];
  const videoTitle = typeof item.meta?.video_title === "string" ? item.meta.video_title : null;
  const readAt = typeof item.meta?.read_at === "string" ? item.meta.read_at : null;
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
  const hasTags = Boolean(tag && (tag.medicines.length || tag.conditions.length || tag.language !== "en"));

  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        leaving ? "pointer-events-none grid-rows-[0fr] scale-[0.98] opacity-0" : "grid-rows-[1fr] opacity-100",
      )}
      aria-hidden={leaving}
    >
      <div className="min-h-0 overflow-hidden">
        <article className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:shadow-md hover:ring-stone-300 sm:p-5", mode === "read" && "bg-stone-50/60")}>
          <div className="flex gap-4">
            {score !== null && (
              <div
                className={cx("hidden size-14 shrink-0 flex-col items-center justify-center rounded-xl ring-1 sm:flex", scoreTone(score))}
                title="Score. The ? button at the bottom right explains it."
              >
                <span className="text-xl font-bold leading-none tabular-nums">{score}</span>
                <span className="mt-0.5 text-[11px] font-medium opacity-90">score</span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                {score !== null && (
                  <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ring-1 sm:hidden", scoreTone(score))} title="Score. The ? button explains it.">
                    score {score}
                  </span>
                )}
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-stone-700">
                  <YouTubeIcon className="size-4 shrink-0" />
                  <span className="truncate">{channel ?? info.label}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {postedLabel}
                </span>
                {mode === "read" && readAt && (
                  <span className="flex items-center gap-1 text-emerald-700">
                    <CheckCheck className="size-3.5" aria-hidden />
                    read {timeAgo(readAt)}
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

              {tag && hasTags && (
                <ul className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label="Named in the comment">
                  {tag.medicines.map((m) => (
                    <Chip key={`m-${m}`} tone="blue" title="Medicine named in the comment" icon={<Pill className="size-3.5" aria-hidden />}>
                      {m}
                    </Chip>
                  ))}
                  {tag.conditions.map((c) => (
                    <Chip key={`c-${c}`} tone="violet" title="Health condition named in the comment" icon={<HeartPulse className="size-3.5" aria-hidden />}>
                      {c}
                    </Chip>
                  ))}
                  {tag.language !== "en" && (
                    <Chip title="Language the comment is written in" icon={<Languages className="size-3.5" aria-hidden />}>
                      {LANGUAGE_LABEL[tag.language ?? ""] ?? tag.language}
                    </Chip>
                  )}
                </ul>
              )}

              {tag?.summary && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="AI summary" />
                  <span>{tag.summary}</span>
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cx("inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100", focus)}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Open on {info.label}
                  </a>
                )}
                {item.url && (
                  <button
                    type="button"
                    onClick={copyLink}
                    aria-label={copied ? "Copied" : "Copy link"}
                    title="Copy link"
                    className={cx("inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50 max-sm:min-h-8 sm:px-3", focus)}
                  >
                    {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                    <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
                  </button>
                )}
                {error && <span className="text-xs text-red-700">{error}</span>}
                <button
                  type="button"
                  disabled={pending || leaving}
                  onClick={() => move(mode === "open")}
                  className={cx(
                    "ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-stone-600 ring-1 ring-stone-200 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50",
                    focus,
                  )}
                  title={mode === "open" ? "Done with this one? It moves to the Read page, where you can bring it back." : "Put this comment back on the list."}
                >
                  {mode === "open" ? <CheckCheck className="size-4" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
                  {mode === "open" ? "Mark as read" : "Move back"}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function Chip({ children, tone, icon, title }: { children: React.ReactNode; tone?: "blue" | "violet"; icon?: React.ReactNode; title: string }) {
  const cls = tone === "blue" ? "bg-sky-50 text-sky-900 ring-sky-200" : tone === "violet" ? "bg-violet-50 text-violet-900 ring-violet-200" : "bg-white text-stone-700 ring-stone-200";
  return (
    <li title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1", cls)}>
      {icon}
      <span className="sr-only">{title}: </span>
      {children}
    </li>
  );
}
