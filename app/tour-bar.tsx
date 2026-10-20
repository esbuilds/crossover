"use client";
// The 60-second judge tour bar (Eric's features push, real Oct 14): shows on any page opened with ?tour=n, pinned to the
// bottom, "n of 3", the stop's line, Next (or Done) and a close link. The stops are lib/tour.ts.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { TOUR, tourHref } from "@/lib/tour.ts";
import { btnPrimary, btnText } from "./ui";

export default function TourBar() {
  const n = Number(useSearchParams().get("tour"));
  const here = usePathname(); // challenge persona (Oct 15): Close and Done at the last stop sent you back to /; stay put
  if (!Number.isInteger(n) || n < 1 || n > TOUR.length) return null;
  return (
    <>
    {/* room at the end of the page so the fixed bar never hides the last lines */}
    <div className="h-56 sm:h-24" aria-hidden />
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-rule-strong bg-surface/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-8">
        <p className="shrink-0 font-mono text-sm text-ink-3">{n} of {TOUR.length}</p>
        <p className="min-w-0 flex-1 text-sm text-ink sm:text-base">{TOUR[n - 1].line}</p>
        <p className="flex shrink-0 items-center gap-4">
          <Link href={here} className={btnText}>Close</Link>
          <Link href={n < TOUR.length ? tourHref(n + 1) : here} className={btnPrimary}>{n < TOUR.length ? "Next" : "Done"}</Link>
        </p>
      </div>
    </div>
    </>
  );
}
