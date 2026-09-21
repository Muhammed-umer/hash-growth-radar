import type { SVGProps } from "react";

/**
 * A plain "video platform" mark: a rounded rectangle with a play triangle.
 * Lucide removed brand logos, so this small SVG stands in for YouTube.
 */
export function YouTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#dc2626" />
      <path d="M10 8.9v6.2l5.2-3.1z" fill="#fff" />
    </svg>
  );
}
