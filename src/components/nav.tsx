import Link from "next/link";
import { NAV_PLATFORMS, PLATFORM_INFO } from "@/lib/config";
import { countsFor, statusCounts } from "@/lib/queries";
import { NavLinks, type NavItem } from "./nav-links";

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

  const items: NavItem[] = [
    { href: "/today", label: "Today", badge: total },
    ...NAV_PLATFORMS.map((p) => ({ href: `/platforms/${p}`, label: PLATFORM_INFO[p].label, badge: badges[p] ?? 0 })),
    { href: "/how", label: "How it works" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/today" className="mr-3 text-base font-semibold tracking-tight">
          Hash Growth Radar
        </Link>
        <nav aria-label="Main">
          <NavLinks items={items} />
        </nav>
      </div>
      {dbError && (
        <div className="bg-amber-50 px-6 py-2 text-xs text-amber-900">
          Database not reachable: {dbError}. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and run the SQL files in supabase/migrations.
        </div>
      )}
    </header>
  );
}
