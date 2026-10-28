"use client";
// The fool-it box, moved out of ask-view.tsx unchanged so the pitch sheet shares it.
import Link from "next/link";
import { useState } from "react";
import { btnPrimary, btnText, field, linkInline, panel } from "../ui";
import { forDisplay, type Check, type Decision, type StepRecord } from "@/lib/ask/check.ts";
import { checkEdit, nudge } from "@/lib/ask/fool.ts";

// Break the checker: edit the reason above and the same checker that gates every answer
// re-checks it here in the browser. Pure code, 0 calls; the answer itself never changes.
// label: the ask page's proof line names it in a few words; the pitch sheet keeps the full label
export function FoolIt({ decision, steps, label = "Try to fool the checker", inline = false }: { decision: Decision; steps: StepRecord[]; label?: string; inline?: boolean }) {
  const first = decision.calls[0]; // none on a name Qloo doesn't know: no box, never a crash
  const shown = first ? forDisplay(first.reason) : "";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(shown);
  const [result, setResult] = useState<Check | null>(null);
  const check = (t: string) => setResult(checkEdit(decision, steps, shown, t));
  if (!first) return null;
  // inline: a bare button inside the caller's line, and the open box takes the line's full width
  if (!open) return inline ? <button type="button" onClick={() => setOpen(true)} className={btnText}>{label}</button> : <p className="mt-2"><button type="button" onClick={() => setOpen(true)} className={btnText}>{label}</button></p>;
  return (
    <div className={`${panel} mt-4 p-4${inline ? " basis-full" : ""}`}>
      <p className="max-w-copy text-sm text-ink-2">Change a number or swap in another brand, then check it. The same code that gates every answer runs here, in your browser.</p>
      {/* autoFocus: the button that opened this is gone, so focus moves into the field instead of dropping to the page */}
      <textarea value={text} onChange={(ev) => (setText(ev.target.value), setResult(null))} aria-label="The first call's reason, editable" rows={3} autoFocus className={`${field} mt-2 w-full`} />
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" onClick={() => check(text)} className={btnPrimary}>Check it</button>
        <button type="button" onClick={() => { const t = nudge(text); setText(t); check(t); }} className={btnText}>Nudge a score</button>
        <button type="button" onClick={() => (setText(shown), setResult(null))} className={btnText}>Reset</button>
      </p>
      {result && (result.ok
        ? <p className="mt-2 text-base text-ink">Passes: every name and number traces to {first.steps.length === 1 ? "the step" : "the steps"} it cites.</p>
        : <div className="mt-2" role="status"><p className="text-base text-ink">Rejected. This answer wouldn&apos;t be shown:</p><ul className="mt-1 list-disc pl-5 font-mono text-sm text-ink-2">{result.problems.map((p) => <li key={p}>{forDisplay(p.replace(/^call 1: /, ""))}</li>)}</ul></div>)}
      <p className="mt-2 text-sm text-ink-3">We attacked it ourselves first: <Link href="/audit#fool-it" className={linkInline}>what it catches, and what got through</Link>.</p>
    </div>
  );
}
