"use client";
import { useEffect } from "react";

// A link straight to a fold (the Devpost's /#what-a-lead-does) opens it. Its own client file so vs-view stays hook-free.
export default function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (el instanceof HTMLDetailsElement && window.location.hash === `#${id}`) {
      el.open = true;
      el.scrollIntoView();
    }
  }, [id]);
  return null;
}
