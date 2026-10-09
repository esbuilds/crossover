"use client";
/* eslint-disable @next/next/no-img-element -- Qloo images are remote and already sized */

import { useState } from "react";
import type { Card } from "@/lib/slate.ts";

export type ProxyDraft = { name: string; description: string; brands: string[] };
type Checked = { proxies: Card[]; rejected: { name: string; reason: string }[]; proposed: string[] };

// "Qloo doesn't know this one yet": the user describes the brand and names brands their customers love.
// /api/proxies verifies them (and Haiku suggests more); the user then confirms, removes, or reorders.
// The first proxy carries the most weight.
export default function ProxyForm({ draft, compact, onBuild }: { draft: ProxyDraft; compact?: boolean; onBuild: (d: ProxyDraft, proxies: Card[]) => void }) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [brands, setBrands] = useState([...draft.brands, "", "", ""].slice(0, 3));
  const [state, setState] = useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<Checked | null>(null);
  const [proxies, setProxies] = useState<Card[]>([]);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
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
    <div className={`rounded-xl border border-dashed border-zinc-300 p-5 ${compact ? "mt-4" : ""}`}>
      <h2 className="font-semibold">{compact ? "None of these?" : "Qloo doesn't know this one yet"}</h2>
      <p className="mt-1 text-sm text-zinc-600">Describe it and name brands your customers also love. Crossover builds the slate from their fans.</p>

      <form onSubmit={check} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-zinc-600">Brand</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2" maxLength={80} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-zinc-600">What is it?</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Single-origin olive oil in squeeze bottles, priced for everyday cooking"
            className="rounded-lg border border-zinc-300 px-3 py-2"
            maxLength={300}
          />
        </label>
        <fieldset className="grid gap-1 text-sm">
          <legend className="mb-1 text-zinc-600">Brands your customers also love (optional, up to three)</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {brands.map((b, i) => (
              <input
                key={i}
                value={b}
                onChange={(e) => setBrands((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Brand ${i + 1}`}
                className="rounded-lg border border-zinc-300 px-3 py-2"
                maxLength={80}
              />
            ))}
          </div>
        </fieldset>
        <div>
          <button disabled={state === "checking" || !name.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {state === "checking" ? "Checking brands in Qloo..." : checked ? "Check again" : "Find stand-in brands"}
          </button>
        </div>
      </form>

      {state === "error" && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {checked && (
        <div className="mt-5">
          {checked.rejected.length > 0 && (
            <p className="mb-3 text-sm text-zinc-500">
              Skipped: {checked.rejected.map((r) => `${r.name} (${r.reason})`).join(", ")}
            </p>
          )}
          {proxies.length > 0 && (
            <>
              <p className="mb-2 text-sm text-zinc-600">Stand-ins Qloo knows. The first one counts most; reorder or remove as you like.</p>
              <ol className="grid gap-2">
                {proxies.map((p, i) => (
                  <li key={p.entity_id} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2">
                    {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-zinc-100" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.name} {i === 0 && <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] text-orange-800">counts most</span>}
                      </p>
                      {p.short_description && <p className="truncate text-xs text-zinc-500">{p.short_description}</p>}
                    </div>
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="px-1 text-zinc-500 disabled:opacity-30" aria-label={`Move ${p.name} up`}>
                      &uarr;
                    </button>
                    <button type="button" disabled={i === proxies.length - 1} onClick={() => move(i, 1)} className="px-1 text-zinc-500 disabled:opacity-30" aria-label={`Move ${p.name} down`}>
                      &darr;
                    </button>
                    <button type="button" onClick={() => setProxies((all) => all.filter((x) => x !== p))} className="px-1 text-sm text-zinc-500 hover:text-red-700">
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {proxies.length < 2 ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {proxies.length === 0 ? "None of those are in Qloo." : "Only one stand-in checked out."} A slate needs at least two. Add another brand your customers love, or describe the brand in more detail, then check again.
            </p>
          ) : (
            <button
              onClick={() => onBuild({ name, description, brands: proxies.map((p) => p.name) }, proxies)}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: "#ea580c" }}
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
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-orange-50 px-4 py-2.5 text-sm text-orange-950">
      <span>
        Based on fans of <strong className="font-semibold">{cards.map((c) => c.name).join(", ")}</strong>
      </span>
      {onEdit && (
        <button onClick={onEdit} className="text-orange-800 underline hover:text-orange-950">
          Edit
        </button>
      )}
    </div>
  );
}
