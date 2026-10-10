import type { Metadata } from "next";
import ReviewView from "./review-view";

// The review desk's front door (PLAN.md section 12, Oct 11 brief): pick three, then see what fame and taste say.
// Not linked yet.
export const metadata: Metadata = { title: "Pick three", robots: { index: false, follow: false } };

export default function ReviewPage() {
  return <ReviewView />;
}
