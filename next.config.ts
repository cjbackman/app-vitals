import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["app-store-scraper", "google-play-scraper"],
};

export default nextConfig;
