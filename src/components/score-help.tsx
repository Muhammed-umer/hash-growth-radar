"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, Languages, Pill, HeartPulse, X } from "lucide-react";
import { AGE_PENALTY_MAX, AGE_PENALTY_PER_DAY, INTENT_BONUS, URGENCY_BONUS } from "@/lib/pipeline/score";
import { SCORE_BANDS } from "@/lib/format";

/**
 * The round "?" button at the bottom right of every page. It opens a small
 * panel explaining the colours on a card and how the score is worked out.
 * The numbers come from the scoring code itself, so they cannot drift.
 */
export function ScoreHelp() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const row = "flex items-start gap-3";
  const k = "text-sm text-stone-700";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="score-help"
        aria-label="What the colours and the score mean"
        title="What the colours and the score mean"
        className="fixed bottom-4 right-4 z-30 grid size-11 place-items-center sm:bottom-5 sm:right-5 sm:size-12 rounded-full bg-emerald-700 text-white shadow-lg transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        {open ? <X className="size-5" aria-hidden /> : <CircleHelp className="size-6" aria-hidden />}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="score-help"
          role="dialog"
          aria-label="How to read a card"
          tabIndex={-1}
          className="fixed bottom-20 right-5 z-30 max-h-[calc(100vh-7rem)] w-[min(24rem,calc(100vw-2.5rem))] origin-bottom-right animate-[dropdown-in_160ms_ease-out] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none ring-1 ring-stone-200 motion-reduce:animate-none"
        >
          <h2 className="text-base font-semibold text-stone-900">How to read a card</h2>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">The score tile</h3>
          <ul className="mt-2 space-y-2">
            <li className={row}>
              <span className="grid h-7 w-9 shrink-0 place-items-center rounded-lg bg-emerald-700 text-xs font-bold text-white">{SCORE_BANDS.strong}+</span>
              <span className={k}>Strong: act on these first.</span>
            </li>
            <li className={row}>
              <span className="grid h-7 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">{SCORE_BANDS.good}+</span>
              <span className={k}>Good: worth a look.</span>
            </li>
            <li className={row}>
              <span className="grid h-7 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600 ring-1 ring-stone-200">&lt;{SCORE_BANDS.good}</span>
              <span className={k}>Weak: a general question, or an old one.</span>
            </li>
          </ul>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">The tags</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            The AI reads each comment and lists the medicines and conditions the comment itself names, never guessed from the video. Each colour is fixed by the kind of
            tag, not random: blue is always a medicine, purple always a condition.
          </p>
          <ul className="mt-2 space-y-2">
            <li className={row}>
              <Tag cls="bg-sky-50 text-sky-900 ring-sky-200" icon={<Pill className="size-3.5" aria-hidden />} text="metformin" />
              <span className={k}>Blue: a medicine.</span>
            </li>
            <li className={row}>
              <Tag cls="bg-violet-50 text-violet-900 ring-violet-200" icon={<HeartPulse className="size-3.5" aria-hidden />} text="pcos" />
              <span className={k}>Purple: a health condition.</span>
            </li>
            <li className={row}>
              <Tag cls="bg-white text-stone-700 ring-stone-200" icon={<Languages className="size-3.5" aria-hidden />} text="Hinglish" />
              <span className={k}>Grey: written in Hinglish or another language.</span>
            </li>
          </ul>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-500">How the score is worked out</h3>
          <table className="mt-2 w-full text-sm">
            <tbody className="text-stone-700">
              <Line label="Fit: how well Hash answers this exact question (from the AI)" value="0 to 100" />
              <Line label="Medicine + food question" value={`+${INTENT_BONUS.medicine_food_question}`} plus />
              <Line label="Asking for a food or calorie app" value={`+${INTENT_BONUS.app_recommendation}`} plus />
              <Line label="Complaint about such an app" value={`+${INTENT_BONUS.competitor_complaint}`} plus />
              <Line label="Urgent (medium / high)" value={`+${URGENCY_BONUS.medium} / +${URGENCY_BONUS.high}`} plus />
              <Line label={`Each day since it was posted (at most ${AGE_PENALTY_MAX})`} value={`−${AGE_PENALTY_PER_DAY}`} minus />
            </tbody>
          </table>
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
            Example: &ldquo;I take metformin, can I eat mango at night?&rdquo;, posted 3 days ago. Fit 92 + {INTENT_BONUS.medicine_food_question} − {3 * AGE_PENALTY_PER_DAY} ={" "}
            <b className="text-stone-900">{92 + INTENT_BONUS.medicine_food_question - 3 * AGE_PENALTY_PER_DAY}</b>. Scores refresh every hour.
          </p>
        </div>
      )}
    </>
  );
}

function Tag({ cls, icon, text }: { cls: string; icon: React.ReactNode; text: string }) {
  return <span className={`inline-flex w-24 shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>{icon}{text}</span>;
}

function Line({ label, value, plus, minus }: { label: string; value: string; plus?: boolean; minus?: boolean }) {
  return (
    <tr className="border-t border-stone-100 first:border-t-0">
      <td className="py-1.5 pr-3 align-top">{label}</td>
      <td className={`whitespace-nowrap py-1.5 text-right align-top font-semibold tabular-nums ${plus ? "text-emerald-700" : minus ? "text-red-700" : "text-stone-900"}`}>{value}</td>
    </tr>
  );
}
