import type { Metadata } from "next";
import TriageView from "./triage-view";

// Inbound triage (PLAN.md section 11, idea 1). Scaffolded Oct 9 (real): resolution only, no fit yet. Not linked.
export const metadata: Metadata = { title: "Inbound triage", robots: { index: false, follow: false } };

export default function TriagePage() {
  return <TriageView />;
}
