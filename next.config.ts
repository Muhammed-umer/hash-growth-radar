import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The list page was called "Today" until 21 Sep 2026; keep old bookmarks working.
  async redirects() {
    return [{ source: "/today", destination: "/shortlist", permanent: true }];
  },
};

export default nextConfig;
