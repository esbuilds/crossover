import { Suspense } from "react";
import { PerRequest } from "@/app/dynamic";
import type { Metadata } from "next";
import Crossover from "../../crossover";
import ProxyLink from "./proxy-link";

// Shareable proxy-mode link: /s/p?name=Graza&d=<description>&p=<id>:10,<id>:5 rebuilds the run without the form.
export async function generateMetadata({ searchParams }: PageProps<"/s/p">): Promise<Metadata> {
  const name = (await searchParams).name;
  return { title: typeof name === "string" && name ? `Partners for ${name.slice(0, 80)}` : "Partners" };
}

export default function SharedProxy() {
  return (
    <>
      <PerRequest />
      <Suspense fallback={<Crossover />}>
        <ProxyLink />
      </Suspense>
    </>
  );
}
