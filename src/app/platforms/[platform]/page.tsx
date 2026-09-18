import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { NAV_PLATFORMS, PLATFORM_INFO } from "@/lib/config";
import { STATUS_LABEL, timeAgo } from "@/lib/format";
import { loadQueue, recentDropped } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { Section } from "@/components/stat";

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

  const [queue, dropped] = await Promise.all([loadQueue({ platform, limit: 25 }), recentDropped(platform, 8)]);
  const now = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{info.label}</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Automatic: comments every 2 hours, new videos every 6, channels daily</span>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">{info.blurb}</p>

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
    </div>
  );
}
