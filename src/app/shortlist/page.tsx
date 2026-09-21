import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { SHORTLIST } from "@/lib/config";
import { pageHref, timeAgo } from "@/lib/format";
import { loadQueuePage, parsePage, parseQueueSort, shortlistFilter } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { SortableList } from "@/components/sort-toggle";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

/**
 * The comments worth a look right now: medicine, app and complaint questions
 * with a score of at least SHORTLIST.min_score, posted in the last
 * SHORTLIST.max_age_days days. Everyone else is on the platform page.
 */
export default async function ShortlistPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const sort = parseQueueSort(sp.sort);
  const requestedPage = parsePage(sp.page);
  const now = new Date();

  const { entries, total } = await loadQueuePage({
    limit: SHORTLIST.page_size,
    offset: (requestedPage - 1) * SHORTLIST.page_size,
    sort,
    filter: shortlistFilter(now),
  });
  const pages = Math.max(1, Math.ceil(total / SHORTLIST.page_size));
  const page = Math.min(requestedPage, pages);
  const from = total === 0 ? 0 : (page - 1) * SHORTLIST.page_size + 1;
  const to = Math.min(total, page * SHORTLIST.page_size);

  return (
    <Suspense>
      <SortableList
        value={sort}
        title={
          <div>
            <h1 className="text-2xl font-semibold">Shortlist ({total.toLocaleString()})</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-600">
              Medicine, app and complaint questions with a score of {SHORTLIST.min_score} or more, posted in the last {SHORTLIST.max_age_days} days. Open one, decide yourself, then Skip it. Everyone else is on the{" "}
              <Link href="/platforms/youtube" className="underline">
                YouTube
              </Link>{" "}
              page.
            </p>
          </div>
        }
      >
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
            Nothing on the shortlist right now. The schedule reads new YouTube comments every 2 hours. The{" "}
            <Link href="/platforms/youtube" className="underline">
              YouTube
            </Link>{" "}
            page lists everyone found so far and what was dropped.
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-500">
              Showing {from}–{to} of {total.toLocaleString()}
            </p>
            <ul className="mt-2 space-y-4">
              {entries.map((e, i) => (
                <li key={e.item.id} className="animate-card-in motion-reduce:animate-none" style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}>
                  <ItemCard item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} showPlatform />
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
                {page > 1 ? (
                  <Link href={pageHref(sp, page - 1)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50">
                    ← Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-stone-500">
                  Page {page} of {pages}
                </span>
                {page < pages ? (
                  <Link href={pageHref(sp, page + 1)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50">
                    Next →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </SortableList>
    </Suspense>
  );
}
