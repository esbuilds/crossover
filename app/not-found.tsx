import { btnPrimary, SiteHeader, shell } from "./ui";
import Link from "next/link";
import type { Metadata } from "next";

// Malformed or untyped share links land here without touching Qloo.
// The tab used to carry the site's full default title, as if the page were the front door (WILD-F7, real Oct 21).
export const metadata: Metadata = { title: "Not found" };
export default function NotFound() {
  return (
    <main className={shell}>
      <SiteHeader />
      <h1 className="mt-page font-display text-2xl sm:text-3xl">That link doesn&apos;t point to anything.</h1>
      <p className="mt-3 max-w-copy text-lg text-ink-2">It may be incomplete or from an older version of the app.</p>
      <Link href="/" className={`${btnPrimary} mt-8`}>
        Ask a name
      </Link>
    </main>
  );
}
