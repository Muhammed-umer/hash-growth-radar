import Link from "next/link";
import { Radar, TriangleAlert } from "lucide-react";
import { NAV_PLATFORMS, PLATFORM_INFO } from "@/lib/config";
import { countsFor, shortlistCount, statusCounts } from "@/lib/queries";
import { NavLinks, type NavItem } from "./nav-links";

/**
 * Shortlist (badge = comments on it now), one link per platform (badge =
 * everyone tagged there), and a plain "How it works" page. Nothing here
 * changes any setting.
 */
export async function Nav() {
  let badges: Record<string, number> = {};
  let shortlisted = 0;
  let dbError: string | null = null;
  try {
    const [all, n] = await Promise.all([statusCounts(), shortlistCount()]);
    for (const p of NAV_PLATFORMS) badges[p] = countsFor(all, p).tagged;
    shortlisted = n;
  } catch (e) {
    badges = {};
    shortlisted = 0;
    dbError = e instanceof Error ? e.message : String(e);
  }

  const items: NavItem[] = [
    { href: "/shortlist", label: "Shortlist", icon: "shortlist", badge: shortlisted },
    ...NAV_PLATFORMS.map((p): NavItem => ({ href: `/platforms/${p}`, label: PLATFORM_INFO[p].label, icon: p, badge: badges[p] ?? 0 })),
    { href: "/how", label: "How it works", icon: "how" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
        <Link href="/shortlist" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-700 text-white shadow-sm">
            <Radar className="size-[18px]" aria-hidden />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold tracking-tight text-stone-900">Growth Radar</span>
            <span className="block text-[11px] text-stone-500">Hash Health</span>
          </span>
        </Link>
        <nav aria-label="Main" className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <NavLinks items={items} />
        </nav>
      </div>
      {dbError && (
        <div className="flex items-start gap-2 bg-amber-50 px-6 py-2 text-xs text-amber-900">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span>
            Database not reachable: {dbError}. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and run the SQL files in supabase/migrations.
          </span>
        </div>
      )}
    </header>
  );
}
