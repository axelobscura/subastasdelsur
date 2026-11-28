import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Photo uploads pass through proxy.ts (matcher /admin). Default buffer is 10MB.
    proxyClientMaxBodySize: "12mb",
    serverActions: {
      // One photo per request, up to 10MB each (nginx allows 20MB).
      bodySizeLimit: "12mb",
    },
  },
  images: {
    // Uploaded photos, served by app/media/[...key]/route.ts
    localPatterns: [{ pathname: "/media/**", search: "" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Only honoured over https (production); browsers ignore it on http://localhost.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
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
};

export default nextConfig;
