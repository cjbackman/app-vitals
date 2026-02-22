import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["app-store-scraper", "google-play-scraper"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.mzstatic.com" }, // Apple CDN
      { protocol: "https", hostname: "play-lh.googleusercontent.com" }, // Google Play CDN
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' https://*.mzstatic.com https://play-lh.googleusercontent.com data:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
