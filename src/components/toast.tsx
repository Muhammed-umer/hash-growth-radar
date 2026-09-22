"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface ToastInput {
  message: string;
  action?: { label: string; run: () => void };
}

const EVENT = "radar:toast";
/** Fired after anything that changes the navbar counts (src/components/nav-links.tsx listens). */
export const COUNTS_CHANGED = "radar:counts-changed";

/** Show a short notice at the bottom of the screen, with an optional button such as Undo. */
export function showToast(t: ToastInput) {
  window.dispatchEvent(new CustomEvent<ToastInput>(EVENT, { detail: t }));
}

export function countsChanged() {
  window.dispatchEvent(new Event(COUNTS_CHANGED));
}

/** One notice at a time; a new one replaces the old. Hides itself after 6 seconds. */
export function Toaster() {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastInput>).detail;
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...detail, id: Date.now() });
      timer.current = setTimeout(() => setToast(null), 6000);
    }
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function close() {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:left-60">
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex animate-[dropdown-in_160ms_ease-out] items-center gap-3 rounded-xl bg-stone-900 py-2.5 pl-4 pr-2 text-sm text-white shadow-lg motion-reduce:animate-none"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                close();
              }}
              className="rounded-lg px-2.5 py-1 font-semibold text-emerald-300 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-1 text-stone-400 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
