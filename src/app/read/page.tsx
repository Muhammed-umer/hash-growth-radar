import type { Metadata } from "next";
import Link from "next/link";
import { CheckCheck, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { RETENTION_DAYS, SHORTLIST } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { loadQueuePage, parsePage } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { Pagination } from "@/components/pagination";
import { PageHeader } from "@/components/stat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Read" };

type Params = Record<string, string | string[] | undefined>;

/**
 * Comments someone marked as read, most recent first. "Move back" returns a
 * comment to the lists. Only the fact that it was read is kept, never whether
 * anyone approached the person.
 */
export default async function ReadPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const requestedPage = parsePage(sp.page);
  const now = new Date();

  const { entries, total } = await loadQueuePage({
    statuses: ["skipped"],
    limit: SHORTLIST.page_size,
    offset: (requestedPage - 1) * SHORTLIST.page_size,
    sort: "read",
  });
  const pages = Math.max(1, Math.ceil(total / SHORTLIST.page_size));
  const page = Math.min(requestedPage, pages);
  const from = total === 0 ? 0 : (page - 1) * SHORTLIST.page_size + 1;
  const to = Math.min(total, page * SHORTLIST.page_size);

  return (
    <div>
      <PageHeader icon={<CheckCheck className="size-5 text-emerald-700" aria-hidden />} title="Read" count={total}>
        Comments you marked as read, most recent first. Press Move back to put one on the lists again. Like every stored comment, they are deleted {RETENTION_DAYS} days
        after YouTube last showed them.
      </PageHeader>

      <section className="mt-8">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
            <Inbox className="size-8 text-stone-400" aria-hidden />
            <p className="mt-3 font-medium text-stone-800">Nothing marked as read yet</p>
            <p className="mt-1 max-w-md text-sm text-stone-500">
              When you are done with a comment on the{" "}
              <Link href="/shortlist" className="underline">
                Shortlist
              </Link>{" "}
              or the YouTube page, press Mark as read and it moves here.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              Showing <span className="font-medium tabular-nums text-stone-800">{from}–{to}</span> of{" "}
              <span className="font-medium tabular-nums text-stone-800">{total.toLocaleString()}</span>
            </p>
            <ul className="mt-3 space-y-4">
              {entries.map((e) => (
                <li key={e.item.id}>
                  <ItemCard item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} mode="read" />
                </li>
              ))}
            </ul>
            <Pagination sp={sp} page={page} pages={pages} />
          </>
        )}
      </section>
    </div>
  );
}
