import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CONFIG, NAV_PLATFORMS, PLATFORM_INFO, YT } from "@/lib/config";
import { env, type EnvKey } from "@/lib/env";
import { STATUS_LABEL, timeAgo } from "@/lib/format";
import { countsFor, loadQueue, recentDropped, recentRuns, statusCounts } from "@/lib/queries";
import { quotaToday } from "@/lib/youtube/client";
import { watchlistStats } from "@/lib/youtube/watchlist";
import { ItemCard } from "@/components/item-card";
import { RunTable } from "@/components/run-table";
import { Section, Stat } from "@/components/stat";

export const dynamic = "force-dynamic";

type NavPlatform = (typeof NAV_PLATFORMS)[number];

function isNavPlatform(p: string): p is NavPlatform {
  return (NAV_PLATFORMS as string[]).includes(p);
}

const DOOR_LABEL: Record<string, string> = {
  sweep: "month sweep",
  search_new: "newest-first search",
  search_relevance: "relevance search",
  channel: "channel uploads",
  coverage: "coverage check",
};

const STATUS_WORD: Record<string, string> = {
  comments_disabled: "with comments off",
  gone: "removed or private",
  retired: "retired (quiet for 180 days)",
};

export default async function PlatformPage({ params }: { params: Promise<{ platform: string }> }) {
  await requireUser();
  const { platform } = await params;
  if (!isNavPlatform(platform)) notFound();
  const info = PLATFORM_INFO[platform];

  const [counts, runs, queue, dropped, watch, quota] = await Promise.all([
    statusCounts(),
    recentRuns(platform, 12),
    loadQueue({ platform, limit: 25 }),
    recentDropped(platform, 8),
    watchlistStats(),
    quotaToday(),
  ]);
  const c = countsFor(counts, platform);
  const now = new Date();
  const lastRead = runs.find((r) => r.job === "collect") ?? null;
  const active = watch.videos_by_status.active ?? 0;
  const sweepPct = watch.sweep_total ? Math.round((watch.sweep_done / watch.sweep_total) * 100) : 0;
  const coverage = watch.last_coverage as { miss_rate_pct?: number; channels_checked?: number; videos_on_channels?: number; missing?: number } | null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{info.label}</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Automatic: comments every 2 hours, new videos every 6, channels daily</span>
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
            <div className="text-xs font-semibold uppercase text-stone-500">Last comment read</div>
            {lastRead ? (
              <p className="mt-1">
                {timeAgo(lastRead.started_at, now)} · <b>{lastRead.status}</b> · fetched {lastRead.fetched}, new {lastRead.stored}, queued {lastRead.queued}, tagged {lastRead.tagged}
                {lastRead.error && <span className="block text-red-800">{lastRead.error}</span>}
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
            <p className="mt-2 text-xs text-stone-500">{CONFIG.youtube_topics.length} topics. Every YouTube call is counted before it is made; jobs stop at {YT.ledger_caps.searches} searches and {YT.ledger_caps.units.toLocaleString()} units.</p>
          </div>
        </div>
      </Section>

      <Section title="Watch list">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="videos watched" value={active} tone="good" />
          <Stat label="videos total" value={watch.videos_total} tone="muted" />
          <Stat label="channels followed" value={watch.channels_followed} tone="good" />
          <Stat label="searches today" value={`${quota.searches} / 100`} tone={quota.searches >= YT.ledger_caps.searches ? "warn" : "muted"} />
          <Stat label="units today" value={`${quota.units.toLocaleString()} / 10,000`} tone={quota.units >= YT.ledger_caps.units ? "warn" : "muted"} />
          <Stat label="month sweep" value={watch.sweep_total ? `${sweepPct}%` : "not started"} tone={watch.sweep_total && sweepPct < 100 ? "warn" : "muted"} />
        </div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-stone-500">Where the videos came from</div>
            <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {Object.entries(watch.videos_by_door).map(([door, n]) => (
                <li key={door} className="flex justify-between"><span>{DOOR_LABEL[door] ?? door}</span><b>{n}</b></li>
              ))}
              {Object.keys(watch.videos_by_door).length === 0 && <li className="text-stone-500">Nothing yet.</li>}
            </ul>
            <p className="mt-2 text-xs text-stone-500">
              {Object.entries(watch.videos_by_status).filter(([s]) => s !== "active").map(([s, n]) => `${n} ${STATUS_WORD[s] ?? s}`).join(" · ") || "Every video is active."}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-stone-500">Coverage check (weekly)</div>
            {coverage && coverage.channels_checked ? (
              <p className="mt-1">
                {coverage.channels_checked} followed channels compared with their real upload lists: {coverage.videos_on_channels} videos, <b>{coverage.missing} missing</b> ({coverage.miss_rate_pct}%). Misses were added on the spot.
              </p>
            ) : (
              <p className="mt-1 text-stone-500">Not run yet. Runs every Monday once channels have been followed.</p>
            )}
            <p className="mt-2 text-xs text-stone-500">
              Sweep: {watch.sweep_done} of {watch.sweep_total} phrase-months done, {watch.sweep_videos.toLocaleString()} videos seen. Channels: {watch.channels_walked} of {watch.channels_followed} histories walked.
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
