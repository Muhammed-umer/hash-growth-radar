import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, Gauge, Inbox, ListChecks, MessageCircleQuestion } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { SHORTLIST } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { loadQueuePage, parsePage, parseQueueSort, shortlistFilter } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { Pagination } from "@/components/pagination";
import { SortableList } from "@/components/sort-toggle";
import { PageHeader } from "@/components/stat";

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

  const rules = [
    { icon: MessageCircleQuestion, text: "Medicine, app or complaint question" },
    { icon: Gauge, text: `Score ${SHORTLIST.min_score} or more` },
    { icon: CalendarClock, text: `Posted in the last ${SHORTLIST.max_age_days} days` },
  ];

  return (
    <div>
      <PageHeader icon={<ListChecks className="size-5 text-emerald-700" aria-hidden />} title="Shortlist" count={total}>
        The best people to look at right now. Open one, decide yourself, then Skip it. Everyone else is on the{" "}
        <Link href="/platforms/youtube" className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:decoration-emerald-700">
          YouTube
        </Link>{" "}
        page.
      </PageHeader>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Rules of the shortlist">
        {rules.map((r) => (
          <li key={r.text} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-sm ring-1 ring-stone-200">
            <r.icon className="size-3.5 text-emerald-700" aria-hidden />
            {r.text}
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <Suspense>
          <SortableList
            value={sort}
            title={
              <p className="text-sm text-stone-500">
                {total === 0 ? (
                  "Nothing to show"
                ) : (
                  <>
                    Showing <span className="font-medium tabular-nums text-stone-800">{from}–{to}</span> of{" "}
                    <span className="font-medium tabular-nums text-stone-800">{total.toLocaleString()}</span>
                  </>
                )}
              </p>
            }
          >
            {entries.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
                <Inbox className="size-8 text-stone-400" aria-hidden />
                <p className="mt-3 font-medium text-stone-800">Nothing on the shortlist right now</p>
                <p className="mt-1 max-w-md text-sm text-stone-500">
                  New YouTube comments are read every 2 hours. The{" "}
                  <Link href="/platforms/youtube" className="underline">
                    YouTube
                  </Link>{" "}
                  page lists everyone found so far and what was dropped.
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-4">
                  {entries.map((e, i) => (
                    <li key={e.item.id} className="animate-card-in motion-reduce:animate-none" style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}>
                      <ItemCard item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} />
                    </li>
                  ))}
                </ul>
                <Pagination sp={sp} page={page} pages={pages} />
              </>
            )}
          </SortableList>
        </Suspense>
      </section>
    </div>
  );
}
