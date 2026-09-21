"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, ListChecks } from "lucide-react";
import { cx } from "@/lib/format";
import { YouTubeIcon } from "./icons";

/** A name, not a component: the nav is built on the server and icons cannot cross to the client. */
export type NavIcon = "shortlist" | "youtube" | "how";

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIcon;
  badge?: number;
}

function Icon({ name, active }: { name: NavIcon; active: boolean }) {
  if (name === "youtube") return <YouTubeIcon className={cx("size-4 transition", active && "[&_rect]:fill-white [&_path]:fill-emerald-700")} />;
  const C = name === "shortlist" ? ListChecks : BookOpen;
  return <C className="size-4" aria-hidden />;
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
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
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
    <div ref={containerRef} className="relative flex items-center gap-1 whitespace-nowrap text-sm">
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute rounded-full bg-emerald-700 shadow-sm",
          ready && "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          box ? "opacity-100" : "opacity-0",
        )}
        style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : undefined}
      />
      {items.map((item) => {
        const active = item.href === activeHref;
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
              "relative z-10 flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition-colors duration-300 motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
              active ? "text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
            )}
          >
            {item.icon && <Icon name={item.icon} active={active} />}
            {item.label}
            {item.badge ? (
              <span
                className={cx(
                  "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums transition-colors duration-300",
                  active ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600",
                )}
              >
                {item.badge.toLocaleString()}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
