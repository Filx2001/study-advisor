import type { NextConfig } from "next";

// Basic security headers on every response.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // the app can't be embedded in other sites (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" }, // browsers must not guess file types
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // don't leak full URLs to other sites
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  }, // the app needs none of these
];

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  devIndicators: false, // hide the "N" development badge
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
