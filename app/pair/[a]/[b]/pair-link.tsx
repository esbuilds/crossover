"use client";

import { useSearchParams } from "next/navigation";
import PairView from "../../pair-view";

export default function PairLink({ a, b }: { a: string; b: string }) {
  const q = useSearchParams();
  return <PairView initial={{ a, b, ta: q.get("ta") ?? undefined, tb: q.get("tb") ?? undefined }} />;
}
