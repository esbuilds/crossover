import { NextResponse, type NextRequest } from "next/server";
import { validShareLink } from "./lib/share-link.ts";

// Malformed share links get a real 404 (Oct 24). The pages stream, so a notFound() in their gate arrives after the
// 200 status is sent; checking the shape here, before render, rewrites to a path that doesn't exist and Next serves
// the not-found page with status 404.
export function proxy(request: NextRequest) {
  if (validShareLink(request.nextUrl.pathname, request.nextUrl.searchParams) === false)
    return NextResponse.rewrite(new URL("/__invalid-share-link", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/s/:id", "/pair/:a/:b", "/triage/:id"] };
