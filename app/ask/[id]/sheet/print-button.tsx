"use client";
import { btnText } from "@/app/ui";

export default function PrintButton() {
  return (
    <button type="button" className={btnText} onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
