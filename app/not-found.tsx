import { btnPrimary, SiteHeader } from "./ui";
import Link from "next/link";

// Malformed or untyped share links land here without touching Qloo.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/pair" label="Check a pairing" />
      <h1 className="mt-16 font-display text-2xl sm:text-3xl">That link doesn&apos;t point to anything.</h1>
      <p className="mt-2 text-base text-ink-2">It may be incomplete or from an older version of the app.</p>
      <Link href="/find" className={`${btnPrimary} mt-6`}>
        Start a new search
      </Link>
    </main>
  );
}
