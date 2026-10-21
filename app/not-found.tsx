import { btnPrimary, SiteHeader, shell } from "./ui";
import Link from "next/link";

// Malformed or untyped share links land here without touching Qloo.
export default function NotFound() {
  return (
    <main className={shell}>
      <SiteHeader />
      <h1 className="mt-page font-display text-2xl sm:text-3xl">That link doesn&apos;t point to anything.</h1>
      <p className="mt-2 text-base text-ink-2">It may be incomplete or from an older version of the app.</p>
      <Link href="/" className={`${btnPrimary} mt-6`}>
        Ask a name
      </Link>
    </main>
  );
}
