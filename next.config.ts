import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second server (e.g. a test copy) can build into its own folder instead of clashing with .next.
  distDir: process.env.CP_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3", "node-cron", "web-push"],
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
};

export default nextConfig;
