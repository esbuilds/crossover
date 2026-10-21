"use client";

import { useState } from "react";
import type { Card } from "@/lib/slate.ts";
import { btnPrimary, btnSecondary, btnText, Chip, field, panel } from "./ui";

export type ProxyDraft = { name: string; description: string; brands: string[] };
type Checked = { proxies: Card[]; rejected: { name: string; reason: string }[]; proposed: string[]; tag: { tag_id: string; name: string } | null; guessed: boolean };

// "Qloo doesn't know this one yet": the user describes the brand and names brands their customers love.
// /api/proxies verifies them (and Haiku suggests more); the user then confirms, removes, or reorders.
// The first proxy carries the most weight.
export default function ProxyForm({
  draft,
  compact,
  onBuild,
}: {
  draft: ProxyDraft;
  compact?: boolean;
  onBuild: (d: ProxyDraft, proxies: Card[], tag?: string) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [brands, setBrands] = useState([...draft.brands, "", "", ""].slice(0, 3));
  const [state, setState] = useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<Checked | null>(null);
  const [proxies, setProxies] = useState<Card[]>([]);

  // Gate (PLAN.md section 8, Oct 14): one named brand, or a description of eight words or more.
  const named = brands.filter((b) => b.trim()).length;
  const words = description.trim().split(/\s+/).filter(Boolean).length;
  const ready = name.trim() && (named > 0 || words >= 8);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setState("checking");
    try {
      const res = await fetch("/api/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, brands: brands.filter((b) => b.trim()) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't check those brands");
      setChecked(body);
      setProxies(body.proxies);
      setState("idle");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  const move = (i: number, by: number) =>
    setProxies((p) => {
      const next = [...p];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  return (
    <div className={`${panel} p-4 sm:p-6 ${compact ? "mt-2" : ""}`}>
      <h2 className="font-display text-xl">{compact ? "None of these?" : "Qloo doesn't know this one yet"}</h2>
      <p className="mt-1 max-w-copy text-base text-ink-2">
        Describe it and name brands your customers also love. Crossover builds the slate from their fans, so the brands you pick steer what comes back.
      </p>

      <form onSubmit={check} className="mt-5 grid max-w-[760px] gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-ink">Brand</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} maxLength={80} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-ink">What is it?</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Single-origin olive oil in squeeze bottles, priced for everyday cooking"
            rows={3}
            className={`${field} resize-y py-2.5`}
            maxLength={300}
          />
        </label>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold text-ink">Brands your customers also love (optional, up to three)</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {brands.map((b, i) => (
              <input
                key={i}
                value={b}
                onChange={(e) => setBrands((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Brand ${i + 1}`}
                className={field}
                maxLength={80}
              />
            ))}
          </div>
        </fieldset>
        <div>
          {!ready && name.trim() && <p className="mb-2 text-base text-ink-2">Name one brand your customers love, or describe the brand in at least eight words.</p>}
          <button disabled={state === "checking" || !ready} className={checked ? btnSecondary : btnPrimary}>
            {state === "checking" ? "Checking brands in Qloo..." : checked ? "Check again" : "Find stand-in brands"}
          </button>
        </div>
      </form>

      {state === "error" && <p className="mt-3 rounded-md bg-danger-tint px-4 py-3 text-base text-danger">{error}</p>}

      {checked && (
        <div className="mt-6 border-t border-rule pt-5">
          {checked.guessed && checked.proxies.length > 0 && (
            <p className="mb-3 rounded-md bg-surface-2 px-4 py-3 text-base text-ink-2">These are guesses. Name a brand your customers love for better stand-ins.</p>
          )}
          {checked.tag && <p className="mb-3 text-base text-ink-2">Brands will lean toward Qloo&apos;s &ldquo;{checked.tag.name}&rdquo; category.</p>}
          {checked.rejected.length > 0 && (
            <p className="mb-3 text-base text-ink-2">
              Skipped: {checked.rejected.map((r) => `${r.name} (${r.reason})`).join(", ")}
            </p>
          )}
          {proxies.length > 0 && (
            <>
              <p className="mb-2 text-base text-ink-2">Stand-ins Qloo knows. The first one counts most; reorder or remove as you like.</p>
              <ol className="grid max-w-[760px]">
                {proxies.map((p, i) => (
                  <li key={p.entity_id} className="flex items-center gap-3 border-t border-rule py-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-base font-semibold">
                        <span className="truncate">{p.name}</span> {i === 0 && <Chip kind="note">Counts most</Chip>}
                      </p>
                      {p.short_description && <p className="truncate text-sm text-ink-3">{p.short_description}</p>}
                    </div>
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="min-h-11 min-w-11 rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30" aria-label={`Move ${p.name} up`}>
                      &uarr;
                    </button>
                    <button type="button" disabled={i === proxies.length - 1} onClick={() => move(i, 1)} className="min-h-11 min-w-11 rounded-md text-ink-2 hover:bg-surface-2 disabled:opacity-30" aria-label={`Move ${p.name} down`}>
                      &darr;
                    </button>
                    <button type="button" onClick={() => setProxies((all) => all.filter((x) => x !== p))} className={`${btnText} px-1 text-sm`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {proxies.length < 2 ? (
            <p className="mt-3 rounded-md bg-surface-2 px-4 py-3 text-base text-ink">
              {proxies.length === 0 ? "None of those are in Qloo." : "Only one stand-in checked out."} A slate needs at least two. Add another brand your customers love, or describe the brand in more detail, then check again.
            </p>
          ) : (
            <button
              onClick={() => onBuild({ name, description, brands: proxies.map((p) => p.name) }, proxies, checked.tag?.tag_id)}
              className={`${btnPrimary} mt-4`}
            >
              Build the slate from these
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Proxy mode: who the slate is really built from. Stays on screen (and in the brief panel); Edit goes back to the form.
export function BasedOn({ cards, onEdit }: { cards: Card[]; onEdit?: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 rounded-md bg-surface-2 px-4 text-base text-ink">
      <span className="py-2.5">
        Based on fans of <strong className="font-semibold">{cards.map((c) => c.name).join(", ")}</strong>
      </span>
      {onEdit && (
        <button onClick={onEdit} className={btnText}>
          Edit
        </button>
      )}
    </div>
  );
}
