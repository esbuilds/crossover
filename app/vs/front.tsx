"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/slate.ts";
import type { VsPayload } from "@/lib/rivals.ts";
import type { Found, RivalPick } from "@/lib/rival.ts";
import { VS_CASES, vsHref, type VsCase } from "@/lib/rivals-cases.ts";
import { btnPrimary, btnQuiet, field, TYPE_LABEL, WhichOne } from "../ui";
import { Skeleton } from "../brief-panel";
import { VsResult } from "./vs-view";
import { COMPETITOR_LABEL } from "@/lib/vs.ts";

// The front door (brief-oct12-front): two names in, the collision map and the columns out. Prepared pairs swap the
// page from the cache (0 Qloo calls); typed names go through the shared resolver, with the picker on either side, and
// never run until both sides are settled. Every result's URL is its /vs id route, so it's a share link. A blank right
// side asks the rival finder (lib/rival.ts) for the closest same-field brand, then runs that pair.
type Side = VsCase["a"];
type Ask = { options: Card[] } | { missing: string } | null;
type Finder = { seed: Side; line: string; result: RivalPick };
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
  const [finder, setFinder] = useState<Finder | null>(null);
  // a new finder answer hides the previous pair until its own pair loads (Checkpoint A: Mt. Joy's chips sat above
  // "Olipop vs Casamara Club")
  const [stale, setStale] = useState(false);
  const cache = useRef(new Map<string, VsPayload>(initial.payload ? [[key(initial.a, initial.b), initial.payload]] : []));

  // the inputs and settled sides take the result's own names, so Compare on an untouched pair needs no search
  function show(a: Side, b: Side, p: VsPayload) {
    setPayload(p);
    setStale(false);
    document.title = `${p.rivals.a.name} vs ${p.rivals.b.name} | Crossover`;
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

  // the closest same-field brand in the seed's top 50; a pick runs the pair, anything else waits for the visitor
  async function findFor(a: Side) {
    setBusy(true);
    try {
      const res = await fetch(`/api/rival?a=${a.id}&ta=${encodeURIComponent(a.type)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Qloo didn't answer. The prepared pairs still work.");
      const seed = { ...a, name: data.seed.name };
      setFinder({ seed, line: data.line, result: data.result });
      setStale(true);
      setBusy(false);
      if (data.result.kind === "pick") load(seed, data.result.pick);
      else setSides([seed, null]);
    } catch (err) {
      setBusy(false);
      setError((err as Error).message);
    }
  }

  // a Qloo competitor_brand tag is a name, not an id: search it only when clicked, picker if ambiguous, then run
  async function byLabel(seed: Side, name: string) {
    setError(null);
    setBusy(true);
    const b = await resolveName(name);
    setBusy(false);
    setQb(name);
    if (b && "id" in b) return b.id === seed.id ? setError("Pick two different names.") : load(seed, b);
    setSides([seed, null]);
    setAsks([null, b]);
  }

  async function compare(e: React.FormEvent) {
    e.preventDefault();
    const typed = [qa.trim(), qb.trim()];
    if (!typed[0]) return;
    setError(null);
    setFinder(null);
    setAsks([null, null]); // old pickers never sit next to a new search
    setBusy(true);
    if (!typed[1]) {
      const a = sides[0] && sides[0].name === typed[0] ? sides[0] : await resolveName(typed[0]);
      setBusy(false);
      if (a && "id" in a) return findFor(a);
      setSides([null, null]);
      return setAsks([a, null]);
    }
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
    if (i === 0 && !qb.trim()) return findFor(s);
    if (next[0] && next[1] && !asks[i === 0 ? 1 : 0]) load(next[0], next[1]);
  }

  const active = sides[0] && sides[1] ? key(sides[0], sides[1]) : null;
  // the method line shows while the result is the finder's seed against its pick or an alternate
  const r = finder?.result.kind === "pick" ? finder.result : null;
  const choices = r ? [r.pick, ...r.alternates] : [];
  const method =
    finder && r && payload && payload.rivals.a.entity_id === finder.seed.id && choices.some((c) => c.id === payload.rivals.b.entity_id)
      ? {
          line: finder.line,
          node: (
            <>
              <FoundChips options={choices} onPick={(f) => load(finder.seed, f)} active={payload.rivals.b.entity_id} />
              <CompetitorChips names={r.competitors} onPick={(n) => byLabel(finder.seed, n)} />
            </>
          ),
        }
      : undefined;
  return (
    <section className="pt-8">
      <p className="max-w-[60ch] text-lg text-ink-2">Put two names in. See where their audiences split on the map, and which brands sit closer to each.</p>
      <form onSubmit={compare} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-start">
        <SideInput label="First name" value={qa} onChange={setQa} ask={asks[0]} onPick={(c) => choose(0, c)} />
        <span className="hidden min-h-11 items-center text-ink-3 sm:inline-flex">vs</span>
        <SideInput label="Second name" value={qb} onChange={setQb} ask={asks[1]} onPick={(c) => choose(1, c)} placeholder="or leave blank to find the closest same-field brand" />
        <button type="submit" disabled={busy} className={btnPrimary}>
          Compare
        </button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 text-base">
        <span className="text-ink-2">Try:</span>
        {VS_CASES.map((c) => (
          <button key={c.a.id} type="button" onClick={() => (setFinder(null), load(c.a, c.b))} className={btnQuiet} aria-current={active === key(c.a, c.b)}>
            {c.a.name} vs {c.b.name}
          </button>
        ))}
      </p>
      {error && <p className="mt-6 text-lg text-ink">{error}</p>}
      {finder && !method && (
        // the finder's answer stands on its own whenever it isn't shown inside the result: chip-only states, a pick
        // still loading, or a pick whose pair the visitor's limit refused
        <div className="mt-6">
          <p className="text-lg text-ink">{finder.line}</p>
          {r ? (
            <FoundChips options={choices} onPick={(f) => load(finder.seed, f)} active={null} />
          ) : (
            "options" in finder.result && <FoundChips options={finder.result.options} onPick={(f) => load(finder.seed, f)} active={null} />
          )}
          {"competitors" in finder.result && <CompetitorChips names={finder.result.competitors} onPick={(n) => byLabel(finder.seed, n)} />}
        </div>
      )}
      {busy && (!payload || stale) ? (
        <Skeleton lines={8} />
      ) : payload && !stale ? (
        <div className={busy ? "opacity-50 transition-opacity" : undefined} aria-busy={busy}>
          {busy && <p className="mt-6 font-mono text-sm text-ink-2 motion-safe:animate-pulse">Comparing in Qloo...</p>}
          <VsResult d={payload} method={method} />
        </div>
      ) : null}
    </section>
  );
}

function CompetitorChips({ names, onPick }: { names: string[]; onPick: (n: string) => void }) {
  if (!names.length) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-4 text-base">
      <span className="text-ink-2">{COMPETITOR_LABEL}</span>
      {names.map((n) => (
        <button key={n} type="button" onClick={() => onPick(n)} className={btnQuiet}>
          {n}
        </button>
      ))}
    </p>
  );
}

function FoundChips({ options, onPick, active }: { options: Found[]; onPick: (f: Found) => void; active: string | null }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-4 text-base">
      <span className="text-ink-2">Compare with:</span>
      {options.map((f) => (
        <button key={f.id} type="button" onClick={() => onPick(f)} className={btnQuiet} aria-current={active === f.id}>
          {f.name}
        </button>
      ))}
    </p>
  );
}

function SideInput({ label, value, onChange, ask, onPick, placeholder }: { label: string; value: string; onChange: (v: string) => void; ask: Ask; onPick: (c: Card) => void; placeholder?: string }) {
  return (
    <div className="min-w-0">
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} maxLength={100} placeholder={placeholder} className={field} />
      {ask && "options" in ask && <WhichOne className="mt-2" options={ask.options} label={(c) => `${c.name} (${TYPE_LABEL[c.type] ?? "entity"})`} onPick={onPick} />}
      {ask && "missing" in ask && <p className="mt-2 text-base text-ink-2">{ask.missing}</p>}
    </div>
  );
}
