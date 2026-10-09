import { ogCard, OG_SIZE } from "@/lib/og.tsx";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Crossover: who should you collab with, and where?";

export default function Image() {
  return ogCard({ title: "Who should you collab with, and where?", line: "Partners and launch markets from what fans already love" });
}
