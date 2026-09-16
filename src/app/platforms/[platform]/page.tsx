import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CONFIG, NAV_PLATFORMS, PLATFORM_INFO, RUNS_PER_DAY } from "@/lib/config";
import { env, type EnvKey } from "@/lib/env";
import { STATUS_LABEL, timeAgo } from "@/lib/format";
import { countsFor, loadQueue, recentDropped, recentRuns, statusCounts } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { RunTable } from "@/components/run-table";
import { Section, Stat } from "@/components/stat";

export const dynamic = "force-dynamic";

type NavPlatform = (typeof NAV_PLATFORMS)[number];

function isNavPlatform(p: string): p is NavPlatform {
  return (NAV_PLATFORMS as string[]).includes(p);
}

export default async function PlatformPage({ params }: { params: Promise<{ platform: string }> }) {
  await requireUser();
  const { platform } = await params;
  if (!isNavPlatform(platform)) notFound();
  const info = PLATFORM_INFO[platform];

  const [counts, runs, queue, dropped] = await Promise.all([
    statusCounts(),
    recentRuns(platform, 10),
    loadQueue({ platform, limit: 25 }),
    recentDropped(platform, 8),
  ]);
  const c = countsFor(counts, platform);
  const now = new Date();
  const lastRun = runs[0] ?? null;
  const perRun = Math.min(CONFIG.youtube_max_searches_per_run, CONFIG.youtube_topics.length);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{info.label}</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Automatic, every 2 hours</span>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">{info.blurb}</p>

      <Section title="Status">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="to look at" value={c.tagged} tone="good" />
          <Stat label="waiting for AI" value={c.queued} tone={c.queued ? "warn" : "muted"} />
          <Stat label="dropped by filter" value={c.filtered} tone="muted" />
          <Stat label="not suitable" value={c.do_not_reply} tone="muted" />
          <Stat label="skipped" value={c.skipped} tone="muted" />
        </div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-stone-500">Last scheduled run</div>
            {lastRun ? (
              <p className="mt-1">
                {timeAgo(lastRun.started_at, now)} · <b>{lastRun.status}</b> · fetched {lastRun.fetched}, new {lastRun.stored}, queued {lastRun.queued}, tagged {lastRun.tagged}
                {lastRun.error && <span className="block text-red-800">{lastRun.error}</span>}
              </p>
            ) : (
              <p className="mt-1 text-stone-500">Never run yet. The schedule fires at the next even hour (UTC).</p>
            )}
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-stone-500">Configuration</div>
            <ul className="mt-1 space-y-0.5">
              {info.requiredEnv.map((k) => (
                <li key={k}>
                  <span className={env(k as EnvKey) ? "text-emerald-700" : "text-red-700"}>{env(k as EnvKey) ? "✓" : "✗"}</span> <code className="text-xs">{k}</code>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-stone-500">
              Each run searches {perRun} of the {CONFIG.youtube_topics.length} topics (they rotate), so {RUNS_PER_DAY} runs a day use about {perRun * RUNS_PER_DAY} of the 100 daily searches,
              and each run reads up to {perRun * CONFIG.youtube_videos_per_topic} videos&apos; comments (1 unit each, of 10,000 a day).
            </p>
          </div>
        </div>
      </Section>

      <Section title={`People to look at (${queue.length})`}>
        {queue.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing to look at on {info.label} right now.</p>
        ) : (
          <div className="space-y-4">
            {queue.map((e) => (
              <ItemCard key={e.item.id} item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recently dropped">
        {dropped.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing dropped yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
            {dropped.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start gap-2 px-3 py-2">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[d.status]}</span>
                <span className="text-xs text-stone-500">{d.filter_reason ?? "AI: not suitable to approach"}</span>
                <span className="w-full truncate text-stone-700">{d.title ?? d.body ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Runs">
        <RunTable runs={runs} />
      </Section>
    </div>
  );
}
