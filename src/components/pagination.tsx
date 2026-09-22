import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageHref } from "@/lib/format";

const btn =
  "inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

/** Previous / page x of y / Next, keeping every other query value. */
export function Pagination({ sp, page, pages }: { sp: Record<string, string | string[] | undefined>; page: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between" aria-label="Pages">
      {page > 1 ? (
        <Link href={pageHref(sp, page - 1)} className={btn}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm tabular-nums text-stone-600">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={pageHref(sp, page + 1)} className={btn}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
