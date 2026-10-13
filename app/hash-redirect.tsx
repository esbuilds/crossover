"use client";
// Old anchors on the front door (before Pick A, Oct 13) now live on their own pages: the Devpost's /#what-a-lead-does
// and Pick three's /#pick-three.
import { useEffect } from "react";

const MOVED: Record<string, string> = { "#pick-three": "/pick-three", "#what-a-lead-does": "/vs#what-a-lead-does" };

export default function HashRedirect() {
  useEffect(() => {
    const to = MOVED[window.location.hash];
    if (to) window.location.replace(to);
  }, []);
  return null;
}
