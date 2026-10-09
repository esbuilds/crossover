"use client";

import { useSearchParams } from "next/navigation";
import Crossover from "../../crossover";

// The server validates p again (lib/proxy-params.ts parseProxies); here it only has to be present.
export default function ProxyLink() {
  const q = useSearchParams();
  const name = q.get("name") ?? "";
  const p = q.get("p") ?? "";
  // t: the category tag and c: refine constraints travel with the link too (t was dropped before Oct 19)
  return <Crossover initialProxy={name && p ? { name, d: q.get("d") ?? "", p, t: q.get("t") ?? undefined, c: q.get("c")?.slice(0, 200) ?? undefined } : undefined} />;
}
