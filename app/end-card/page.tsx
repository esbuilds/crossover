import type { Metadata } from "next";
import { Mark } from "@/lib/mark.tsx";

// The video's end card (Oct 26). Not linked from anywhere; no sitemap exists, and it asks not to be indexed.
export const metadata: Metadata = { title: { absolute: "Crossover" }, robots: { index: false, follow: false } };

export default function EndCard() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-8 text-center">
      <Mark size={96} />
      <p className="mt-8 font-display text-4xl text-ink sm:text-[5rem] sm:leading-none">Crossover</p>
      <p className="mt-8 text-2xl text-ink">crossover-henna.vercel.app</p>
      <div className="mt-10 h-px w-24 bg-rule-strong" />
      <p className="mt-10 text-lg text-ink-2">Built on Qloo&apos;s taste graph</p>
      <p className="mt-2 text-lg text-ink-2">MIT, github.com/esbuilds/crossover</p>
    </main>
  );
}
