"use client";

import { useSearchParams } from "next/navigation";
import Crossover from "../../crossover";

// The server validates p again (lib/proxy-params.ts parseProxies); here it only has to be present.
export default function ProxyLink() {
  const q = useSearchParams();
  const name = q.get("name") ?? "";
  const p = q.get("p") ?? "";
  return <Crossover initialProxy={name && p ? { name, d: q.get("d") ?? "", p } : undefined} />;
}
