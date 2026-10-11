"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/slate.ts";
import type { VsPayload } from "@/lib/rivals.ts";
import { VS_CASES, vsHref, type VsCase } from "@/lib/rivals-cases.ts";
import { btnPrimary, btnQuiet, field, TYPE_LABEL, WhichOne } from "../ui";
import { Skeleton } from "../brief-panel";
import { VsResult } from "./vs-view";

// The front door (brief-oct12-front): two names in, the collision map and the columns out. Prepared pairs swap the
// page from the cache (0 Qloo calls); typed names go through the shared resolver, with the picker on either side, and
// never run until both sides are settled. Every result's URL is its /vs id route, so it's a share link.
type Side = VsCase["a"];
type Ask = { options: Card[] } | { missing: string } | null;
const key = (a: Side, b: Side) => `${a.id}|${b.id}`;
const href = (a: Side, b: Side) => vsHref({ a, b });
const toSide = (c: Card): Side => ({ id: c.entity_id, name: c.name, type: c.type });

export default function Front({ initial }: { initial: { a: Side; b: Side; payload: VsPayload | null; error?: string } }) {
  const named = (s: Side, n?: string) => ({ ...s, name: n ?? s.name });
  const [qa, setQa] = useState(initial.payload?.rivals.a.name ?? initial.a.name);
  const [qb, setQb] = useState(initial.payload?.rivals.b.name ?? initial.b.name);
  const [sides, setSides] = useState<[Side | null, Side | null]>([named(initial.a, initial.payload?.rivals.a.name), named(initial.b, initial.payload?.rivals.b.name)]);
  const [asks, setAsks] = useState<[Ask, Ask]>([null, null]);
  const [payload, setPayload] = useState(initial.payload);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial.error ?? null);
  const cache = useRef(new Map<string, VsPayload>(initial.payload ? [[key(initial.a, initial.b), initial.payload]] : []));

  // the inputs and settled sides take the result's own names, so Compare on an untouched pair needs no search
  function show(a: Side, b: Side, p: VsPayload) {
    setPayload(p);
    setQa(p.rivals.a.name);
    setQb(p.rivals.b.name);
    setSides([{ ...a, name: p.rivals.a.name }, { ...b, name: p.rivals.b.name }]);
  }

  async function load(a: Side, b: Side, push = true) {
    setSides([a, b]);
    setAsks([null, null]);
    setError(null);
    if (push) window.history.pushState(null, "", href(a, b));
    const hit = cache.current.get(key(a, b));
    if (hit) return show(a, b, hit);
    setBusy(true);
    try {
      const res = await fetch(`/api/rivals?a=${a.id}&ta=${encodeURIComponent(a.type)}&b=${b.id}&tb=${encodeURIComponent(b.type)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Qloo didn't answer. The prepared pairs still work.");
      cache.current.set(key(a, b), data);
      show(a, b, data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // first paint was cold (the server never spends on the front door): fetch it once here
  useEffect(() => {
    if (!initial.payload && !initial.error) load(initial.a, initial.b, false); // eslint-disable-line react-hooks/set-state-in-effect -- one fetch when first paint was cold
    const back = () => {
      const m = /^\/vs\/([^/]+)\/([^/]+)/.exec(location.pathname);
      const q = new URLSearchParams(location.search);
      if (!m) return load(VS_CASES[0].a, VS_CASES[0].b, false);
      load({ id: m[1], name: "", type: q.get("ta") ?? "" }, { id: m[2], name: "", type: q.get("tb") ?? "" }, false);
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolveName(q: string): Promise<Side | Ask> {
    try {
      const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
      const r = await res.json();
      if (!res.ok) return { missing: r.error ?? "Couldn't search Qloo" };
      if (r.status === "confident") return toSide(r.candidates[0]);
      if (r.status === "ambiguous") return { options: r.candidates };
      return { missing: `Qloo doesn't know "${q}".` };
    } catch {
      return { missing: "Couldn't search Qloo" };
    }
  }

  async function compare(e: React.FormEvent) {
    e.preventDefault();
    const typed = [qa.trim(), qb.trim()];
    if (!typed[0] || !typed[1]) return;
    setError(null);
    setBusy(true);
    // a side whose text still matches its settled name keeps its id (no search)
    const next = await Promise.all(typed.map((q, i) => (sides[i] && sides[i]!.name === q ? sides[i]! : resolveName(q))));
    setBusy(false);
    const settled = next.map((x) => (x && "id" in x ? x : null)) as [Side | null, Side | null];
    setSides(settled);
    setAsks(next.map((x) => (x && "id" in x ? null : x)) as [Ask, Ask]);
    if (settled[0] && settled[1]) {
      if (settled[0].id === settled[1].id) setError("Pick two different names.");
      else load(settled[0], settled[1]);
    }
  }

  function choose(i: 0 | 1, c: Card) {
    const s = toSide(c);
    const next: [Side | null, Side | null] = i === 0 ? [s, sides[1]] : [sides[0], s];
    if (i === 0) setQa(s.name);
    else setQb(s.name);
    setSides(next);
    setAsks((a) => (i === 0 ? [null, a[1]] : [a[0], null]));
    if (next[0] && next[1] && !asks[i === 0 ? 1 : 0]) load(next[0], next[1]);
  }

  const active = sides[0] && sides[1] ? key(sides[0], sides[1]) : null;
  return (
    <section className="pt-8">
      <p className="max-w-[60ch] text-lg text-ink-2">Put two names in. See where their audiences split on the map, and which brands sit closer to each.</p>
      <form onSubmit={compare} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-start">
        <SideInput label="First name" value={qa} onChange={setQa} ask={asks[0]} onPick={(c) => choose(0, c)} />
        <span className="hidden min-h-11 items-center text-ink-3 sm:inline-flex">vs</span>
        <SideInput label="Second name" value={qb} onChange={setQb} ask={asks[1]} onPick={(c) => choose(1, c)} />
        <button type="submit" disabled={busy} className={btnPrimary}>
          Compare
        </button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 text-base">
        <span className="text-ink-2">Try:</span>
        {VS_CASES.map((c) => (
          <button key={c.a.id} type="button" onClick={() => load(c.a, c.b)} className={btnQuiet} aria-current={active === key(c.a, c.b)}>
            {c.a.name} vs {c.b.name}
          </button>
        ))}
      </p>
      {error && <p className="mt-6 text-lg text-ink">{error}</p>}
      {busy && !payload ? (
        <Skeleton lines={8} />
      ) : payload ? (
        <div className={busy ? "opacity-50 transition-opacity" : undefined} aria-busy={busy}>
          {busy && <p className="mt-6 font-mono text-sm text-ink-2 motion-safe:animate-pulse">Comparing in Qloo...</p>}
          <VsResult d={payload} />
        </div>
      ) : null}
    </section>
  );
}

function SideInput({ label, value, onChange, ask, onPick }: { label: string; value: string; onChange: (v: string) => void; ask: Ask; onPick: (c: Card) => void }) {
  return (
    <div className="min-w-0">
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} className={field} />
      {ask && "options" in ask && <WhichOne className="mt-2" options={ask.options} label={(c) => `${c.name} (${TYPE_LABEL[c.type] ?? "entity"})`} onPick={onPick} />}
      {ask && "missing" in ask && <p className="mt-2 text-base text-ink-2">{ask.missing}</p>}
    </div>
  );
}
