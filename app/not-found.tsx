import Link from "next/link";

// Malformed or untyped share links land here without touching Qloo.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-20">
      <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Crossover</p>
      <h1 className="mt-2 text-2xl font-semibold">That link doesn&apos;t point to anything.</h1>
      <p className="mt-2 text-zinc-600">It may be incomplete or from an older version of the app.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-white">
        Start a new search
      </Link>
    </main>
  );
}
