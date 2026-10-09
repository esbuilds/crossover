import type { Metadata } from "next";
import PairView from "./pair-view";

export const metadata: Metadata = { title: "Check a pairing" };

export default function PairPage() {
  return <PairView />;
}
