"use client";
import { btnQuiet } from "@/app/ui";

export default function PrintButton() {
  return (
    <button type="button" className={btnQuiet} onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
