// app/ask/page.tsx
import type { Metadata } from "next";
import { SiteHeader } from "../ui";
import AskView from "./ask-view";

export const metadata: Metadata = { title: "Ask who a brand should call | Crossover", description: "One name in. An agent runs Qloo's measurements step by step and says who to call first, with every line tied to the step behind it." };

export default function AskPage() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/" label="The split" />
      <AskView />
    </main>
  );
}
