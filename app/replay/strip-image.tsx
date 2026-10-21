import control from "@/audit/replay-control.json";

// The deal strip (SPECTACLE-1) as placed on /audit#replays and /replay; the image is app/replay/strip/[size]/route.tsx.
export function StripImage({ className = "" }: { className?: string }) {
  const alt = `The 23 replayed deals as rows of eight slots ranked left to right, the real partner's slot filled. The real partner sits in the first three slots ${control.summary.realHits} times in ${control.summary.cases}, and ${control.summary.scrambledHits} times in ${control.summary.cases} with the seed scrambled.`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a built PNG from our own route; next/image adds nothing here
    <img src="/replay/strip/1200" width={1200} height={800} alt={alt} className={`h-auto w-full max-w-[900px] rounded-md border border-rule ${className}`} />
  );
}
