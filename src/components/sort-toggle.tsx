"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Clock, TrendingUp, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/format";
import type { QueueSort } from "@/lib/queries";

const OPTIONS: Array<{ value: QueueSort; label: string; hint: string; icon: LucideIcon }> = [
  { value: "latest", label: "Latest", hint: "Newest comments first", icon: Clock },
  { value: "score", label: "Score", hint: "Highest score first", icon: TrendingUp },
];

/**
 * A two-part switch: left half Latest, right half Score, with a pill that
 * slides between them. The pill moves on click; the list below fades while the
 * new order loads, then fades back in. The order is kept in ?sort= so a
 * refresh or a shared link shows the same order.
 */
export function SortableList({ value, title, children }: { value: QueueSort; title: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Shows the clicked side at once; falls back to the URL's value once the new
  // order has loaded (or if the back button changes it).
  const [selected, setSelected] = useOptimistic<QueueSort>(value);

  function choose(next: QueueSort) {
    if (next === selected) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", next);
    startTransition(() => {
      setSelected(next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const index = OPTIONS.findIndex((o) => o.value === selected);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title}
        <div role="radiogroup" aria-label="Sort the list" className="relative grid shrink-0 grid-cols-2 rounded-full bg-white p-1 text-sm shadow-sm ring-1 ring-stone-200">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-emerald-700 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {OPTIONS.map((o) => {
            const active = o.value === selected;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={o.hint}
                onClick={() => choose(o.value)}
                className={cx(
                  "relative z-10 flex min-w-24 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors duration-300 motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                  active ? "text-white" : "text-stone-600 hover:text-stone-900",
                )}
              >
                <o.icon className="size-4" aria-hidden />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-busy={pending}
        className={cx("mt-4 transition-opacity duration-200 motion-reduce:transition-none", pending ? "pointer-events-none opacity-40" : "opacity-100")}
      >
        {children}
      </div>
    </div>
  );
}
