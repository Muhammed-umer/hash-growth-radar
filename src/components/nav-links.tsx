"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, CheckCheck, ListChecks } from "lucide-react";
import { cx } from "@/lib/format";
import type { NavCounts } from "@/lib/queries";
import { YouTubeIcon } from "./icons";
import { COUNTS_CHANGED } from "./toast";

/** A name, not a component: the nav is built on the server and icons cannot cross to the client. */
export type NavIcon = "shortlist" | "youtube" | "read" | "how";

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIcon;
  /** Which count the badge shows: "shortlist", "read", or "platform:<name>". */
  countKey?: string;
}

function Icon({ name, active }: { name: NavIcon; active: boolean }) {
  if (name === "youtube") return <YouTubeIcon className={cx("size-4 transition", active && "[&_rect]:fill-white [&_path]:fill-emerald-700")} />;
  const C = name === "shortlist" ? ListChecks : name === "read" ? CheckCheck : BookOpen;
  return <C className="size-4" aria-hidden />;
}

function countFor(counts: NavCounts | null, key: string | undefined): number {
  if (!counts || !key) return 0;
  if (key === "shortlist") return counts.shortlist;
  if (key === "read") return counts.read;
  if (key.startsWith("platform:")) return counts.platforms[key.slice(9)] ?? 0;
  return 0;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The top navigation with a highlight that slides to the page you click.
 * The highlight moves the moment you click (before the page has loaded), and
 * settles on the real page once it arrives. Plain CSS transitions, so it works
 * in every browser; people who ask their system for less motion get no slide.
 */
export function NavLinks({ items, initialCounts }: { items: NavItem[]; initialCounts: NavCounts | null }) {
  const pathname = usePathname();

  // Badges. The layout's counts are only fresh on a full page load: Next.js
  // keeps the layout when you move between pages. So the counts are asked for
  // again after every page change and every "mark as read", and a newer server
  // render (after revalidation) replaces them too.
  const [counts, setCounts] = useState<NavCounts | null>(initialCounts);
  const [seenInitial, setSeenInitial] = useState(initialCounts);
  if (initialCounts !== seenInitial) {
    setSeenInitial(initialCounts);
    setCounts(initialCounts);
  }
  const firstLoad = useRef(true);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/nav-counts", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as NavCounts;
        if (!cancelled) setCounts(next);
      } catch {
        // Keep the last counts; the next page change tries again.
      }
    }
    if (firstLoad.current) firstLoad.current = false;
    else void refresh();
    window.addEventListener(COUNTS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(COUNTS_CHANGED, refresh);
    };
  }, [pathname]);

  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  // A click counts only until the page changes. Comparing against the page it
  // was made from is not enough: a link in the page body could later bring
  // you back to that page and revive the old click, leaving the highlight on
  // the wrong tab. So the click is forgotten the moment the pathname moves.
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    setClicked(null);
  }
  const pendingHref = clicked && clicked.from === pathname ? clicked.href : null;
  const activeHref = pendingHref ?? items.find((i) => isActive(pathname, i.href))?.href ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = activeHref ? linkRefs.current.get(activeHref) : null;
    if (!el) {
      setBox(null);
      return;
    }
    setBox({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  }, [activeHref]);

  useLayoutEffect(measure, [measure, items]);

  useEffect(() => {
    // Skip the slide on first paint so the highlight does not fly in from the corner.
    const id = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [measure]);

  return (
    <div ref={containerRef} className="relative grid grid-cols-4 gap-1 whitespace-nowrap text-sm sm:flex sm:items-center lg:flex-col lg:items-stretch">
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute rounded-xl bg-emerald-700 shadow-sm sm:rounded-full lg:rounded-lg",
          ready && "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          box ? "opacity-100" : "opacity-0",
        )}
        style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : undefined}
      />
      {items.map((item) => {
        const active = item.href === activeHref;
        const badge = countFor(counts, item.countKey);
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(el) => {
              if (el) linkRefs.current.set(item.href, el);
              else linkRefs.current.delete(item.href);
            }}
            onClick={() => setClicked({ href: item.href, from: pathname })}
            aria-current={active && !pendingHref ? "page" : undefined}
            className={cx(
              "relative z-10 flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors duration-300 motion-reduce:transition-none",
              "sm:flex-row sm:gap-2 sm:rounded-full sm:px-3 sm:text-sm lg:rounded-lg lg:py-2",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
              active ? "text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
            )}
          >
            {/* Phones: icon and badge on one line, label under them. From sm up the wrapper
                disappears (display: contents) and the badge moves after the label. */}
            <span className="flex items-center gap-1 sm:contents">
              {item.icon && <Icon name={item.icon} active={active} />}
              {badge ? (
                <span
                  className={cx(
                    "rounded-full px-1 py-px text-[11px] font-semibold leading-tight tabular-nums transition-colors duration-300 sm:order-last sm:px-1.5 lg:ml-auto",
                    active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600",
                  )}
                >
                  {badge.toLocaleString()}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
