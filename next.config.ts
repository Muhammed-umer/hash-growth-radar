import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "/" is redirected here rather than by a page: a page at "/" was prerendered at
  // build time, navbar counts included, and those frozen counts stayed on screen
  // after the redirect. The list page was called "Today" until 21 Sep 2026.
  async redirects() {
    return [
      { source: "/", destination: "/shortlist", permanent: false },
      { source: "/today", destination: "/shortlist", permanent: true },
    ];
  },
};

export default nextConfig;
