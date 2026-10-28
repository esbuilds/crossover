import type { MetadataRoute } from "next";

// /robots.txt used to be the HTML 404 page. Crawlers may read every page (share pages and
// preview cards read the cache only, never Qloo); the API routes are for the app and MCP clients.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
