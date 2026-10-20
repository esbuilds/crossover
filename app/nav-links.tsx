"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// "Real deals", not "Spot the real partner": the long label wrapped the nav at 390 and 360 and moved the card (523 to 567)
const NAV: [string, string][] = [["/", "Ask"], ["/vs", "Two names in"], ["/replay", "Real deals"], ["/audit", "The audit"]];

// The header's links (DC F1, TR F3): no underline, and the current page sits on the header rule. /ask/* and /s/* are Ask.
export default function NavLinks() {
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" || path.startsWith("/ask/") || path.startsWith("/s/") : path === href || path.startsWith(`${href}/`));
  return (
    // -mb-3 with pb-3 on the links: each link reaches down to the header's bottom rule, so the current mark lies on it
    <nav className="-mb-3 flex flex-wrap gap-x-4">
      {NAV.map(([href, label]) => (
        <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} className="inline-flex min-h-11 items-center pb-3 box-content text-sm text-ink-2 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:shadow-[0_1px_0_var(--color-ink)]">
          {label}
        </Link>
      ))}
    </nav>
  );
}
