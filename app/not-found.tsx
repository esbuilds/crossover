import Link from "next/link";
import { btnPrimary } from "./ui";

// Malformed or untyped share links land here without touching Qloo.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 py-20 sm:px-8">
      <Link href="/" className="font-display text-xl">
        Crossover
      </Link>
      <h1 className="mt-10 font-display text-2xl sm:text-3xl">That link doesn&apos;t point to anything.</h1>
      <p className="mt-2 text-base text-ink-2">It may be incomplete or from an older version of the app.</p>
      <Link href="/" className={`${btnPrimary} mt-6`}>
        Start a new search
      </Link>
    </main>
  );
}
