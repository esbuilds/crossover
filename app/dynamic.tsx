import { Suspense } from "react";
import { connection } from "next/server";

// Marks a page as rendered per request, so its generateMetadata may read params, searchParams and the cache
// (Next 16 cacheComponents: https://nextjs.org/docs/messages/blocking-prerender-metadata-dynamic).
async function Marker() {
  await connection();
  return null;
}
export function PerRequest() {
  return (
    <Suspense>
      <Marker />
    </Suspense>
  );
}
