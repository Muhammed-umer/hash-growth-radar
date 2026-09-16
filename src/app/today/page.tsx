import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NAV_PLATFORMS, PLATFORM_INFO, TOP_N } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { countsFor, jobCounts, loadQueue, statusCounts } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { Section, Stat } from "@/components/stat";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  await requireUser();
  const [queue, counts, jobs] = await Promise.all([loadQueue({ limit: TOP_N }), statusCounts(), jobCounts()]);
  const now = new Date();
  const sum = (key: "tagged" | "do_not_reply" | "posted" | "skipped") => NAV_PLATFORMS.reduce((a, p) => a + countsFor(counts, p)[key], 0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-stone-600">The {TOP_N} people most worth approaching, across every platform. Open the thread and decide yourself. Refreshed every 2 hours by the schedule.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="to look at" value={sum("tagged")} tone="good" />
        <Stat label="waiting for AI" value={jobs.pending + jobs.running} tone={jobs.pending ? "warn" : "muted"} />
        <Stat label="AI jobs failed" value={jobs.failed} tone={jobs.failed ? "bad" : "muted"} />
        <Stat label="approached" value={sum("posted")} />
        <Stat label="skipped" value={sum("skipped")} tone="muted" />
        <Stat label="not suitable" value={sum("do_not_reply")} tone="muted" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {NAV_PLATFORMS.map((p) => {
          const c = countsFor(counts, p);
          return (
            <Link key={p} href={`/platforms/${p}`} className="rounded-full border border-stone-200 bg-white px-3 py-1 hover:bg-stone-100">
              {PLATFORM_INFO[p].label}: <b>{c.tagged}</b> to look at · {c.posted} approached
            </Link>
          );
        })}
      </div>

      <Section title={`Top ${TOP_N}`}>
        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
            Nothing to show yet. Run a collection on the <Link href="/platforms/youtube" className="underline">YouTube</Link> page, or paste a post on the{" "}
            <Link href="/platforms/reddit" className="underline">Reddit</Link> page.
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((e) => (
              <ItemCard key={e.item.id} item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} showPlatform />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
