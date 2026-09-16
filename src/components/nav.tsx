import Link from "next/link";
import { NAV_PLATFORMS, PLATFORM_INFO } from "@/lib/config";
import { countsFor, statusCounts } from "@/lib/queries";

/**
 * Today, one link per platform (badge = people waiting to be looked at),
 * and a plain "How it works" page. Nothing here changes any setting.
 */
export async function Nav() {
  let badges: Record<string, number> = {};
  let dbError: string | null = null;
  try {
    const all = await statusCounts();
    for (const p of NAV_PLATFORMS) badges[p] = countsFor(all, p).tagged;
  } catch (e) {
    badges = {};
    dbError = e instanceof Error ? e.message : String(e);
  }
  const total = Object.values(badges).reduce((a, b) => a + b, 0);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/today" className="mr-3 text-base font-semibold tracking-tight">
          Hash Growth Radar
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <NavLink href="/today" label="Today" badge={total} />
          {NAV_PLATFORMS.map((p) => (
            <NavLink key={p} href={`/platforms/${p}`} label={PLATFORM_INFO[p].label} badge={badges[p] ?? 0} />
          ))}
          <NavLink href="/how" label="How it works" />
        </nav>
      </div>
      {dbError && (
        <div className="bg-amber-50 px-6 py-2 text-xs text-amber-900">
          Database not reachable: {dbError}. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and run supabase/migrations/0001_schema.sql.
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link href={href} className="flex items-center gap-1 rounded-full px-3 py-1 hover:bg-stone-100">
      {label}
      {badge ? <span className="rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">{badge}</span> : null}
    </Link>
  );
}
