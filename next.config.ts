import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Oct 13: the ask is the front door. Old Pick three links (/?c=, /?s=, /review) open /pick-three with their
  // query; /ask is the home page.
  async redirects() {
    return [
      { source: "/", has: [{ type: "query", key: "c" }], destination: "/pick-three", permanent: false },
      { source: "/", has: [{ type: "query", key: "s" }], destination: "/pick-three", permanent: false },
      { source: "/review", destination: "/pick-three", permanent: false },
      { source: "/ask", destination: "/", permanent: false },
    ];
  },
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
