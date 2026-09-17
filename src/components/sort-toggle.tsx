import Link from "next/link";
import { cx } from "@/lib/format";
import type { QueueSort } from "@/lib/queries";

const OPTIONS: Array<{ value: QueueSort; label: string; hint: string }> = [
  { value: "latest", label: "Latest", hint: "Newest comments first" },
  { value: "score", label: "Score", hint: "Highest score first" },
];

/**
 * A two-part switch: left half Latest, right half Score. Each half is a plain
 * link that sets ?sort= on the current page, so it works without client JS
 * and the chosen order survives a refresh or a shared link.
 */
export function SortToggle({ value, basePath }: { value: QueueSort; basePath: string }) {
  return (
    <div role="group" aria-label="Sort the list" className="inline-flex rounded-full border border-stone-300 bg-stone-100 p-1 text-sm">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <Link
            key={o.value}
            href={`${basePath}?sort=${o.value}`}
            aria-current={active ? "true" : undefined}
            title={o.hint}
            scroll={false}
            className={cx(
              "min-w-24 rounded-full px-4 py-1.5 text-center font-medium transition-colors",
              active ? "bg-emerald-700 text-white shadow-sm" : "text-stone-600 hover:bg-white hover:text-stone-900",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
