import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { TOP_N } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { loadQueue, parseQueueSort } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { SortToggle } from "@/components/sort-toggle";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const sort = parseQueueSort((await searchParams).sort);
  const queue = await loadQueue({ limit: TOP_N, sort });
  const now = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Today</h1>
        <SortToggle value={sort} basePath="/today" />
      </div>

      <div className="mt-6">
        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
            Nothing to show yet. The schedule collects from YouTube every 2 hours; see the <Link href="/platforms/youtube" className="underline">YouTube</Link> page for the last run.
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((e) => (
              <ItemCard key={e.item.id} item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} showPlatform />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
