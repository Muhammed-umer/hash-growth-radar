import Link from "next/link";
import { connection } from "next/server";
import { Radar, TriangleAlert } from "lucide-react";
import { NAV_PLATFORMS, PLATFORM_INFO } from "@/lib/config";
import { navCounts, type NavCounts } from "@/lib/queries";
import { NavLinks, type NavItem } from "./nav-links";

/**
 * Shortlist (badge = comments on it now), one link per platform (badge =
 * everyone tagged there), Read (comments marked as read), and a plain "How it
 * works" page. Nothing here changes any setting.
 */
export async function Nav() {
  // Counts must come from the request, never from a build-time render.
  await connection();
  let counts: NavCounts | null = null;
  let dbError: string | null = null;
  try {
    counts = await navCounts();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const items: NavItem[] = [
    { href: "/shortlist", label: "Shortlist", icon: "shortlist", countKey: "shortlist" },
    ...NAV_PLATFORMS.map((p): NavItem => ({ href: `/platforms/${p}`, label: PLATFORM_INFO[p].label, icon: p, countKey: `platform:${p}` })),
    { href: "/read", label: "Read", icon: "read", countKey: "read" },
    { href: "/how", label: "How it works", icon: "how" },
  ];

  return (
    <header
      className={
        // Phones and tablets: a bar across the top. Large screens (lg, 1024 px+): a fixed column on the left.
        "sticky top-0 z-20 border-b border-stone-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70 " +
        "lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r lg:bg-white lg:backdrop-blur-none"
      }
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-2 py-1.5 sm:gap-4 sm:px-6 sm:py-2.5 lg:mx-0 lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:gap-6 lg:px-4 lg:py-5">
        <Link
          href="/shortlist"
          aria-label="Home: Shortlist"
          title="Shortlist"
          className="hidden size-8 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white shadow-sm sm:grid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <Radar className="size-[18px]" aria-hidden />
        </Link>
        <nav aria-label="Main" className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:overflow-visible">
          <NavLinks items={items} initialCounts={counts} />
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
