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
