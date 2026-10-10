"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, Pick } from "@/lib/slate.ts";
import type { Ref, Review, ReviewGroup, ReviewRow } from "@/lib/review.ts";
import { CASES, type CaseName, type PreparedCase } from "@/lib/review-cases.ts";
import { nameOf, shareQuery, type Shared } from "@/lib/review-share.ts";
import BriefPanel from "../brief-panel";
import { btnPrimary, btnQuiet, btnSecondary, Chip, field, SiteHeader, TYPE_LABEL } from "../ui";

// Renders /api/review (review-v3). Groups, picks, gates and evidence labels all come from the route; this page only
// hides them until the visitor has picked, then lays fame and taste side by side.
type Ranks = Record<string, { amongSeedFans?: number | null; seedAmongTheirs?: number | null }>;
type Result = Review & { ranks: Ranks };
type Buyer = PreparedCase["gate"]["buyer"];
type Body = { seed: string | CaseName; names: (string | CaseName)[]; only?: string; buyer?: Buyer };
type Res = { key: string; data: Result | null; error?: string; seedOptions?: Ref[] };

const MAX = 8;
const WORDS = ["", "", "", "", "four", "five", "six", "seven", "eight"];
const caseBody = (c: PreparedCase, gate: boolean): Body => ({ seed: c.seed, names: c.names, ...(gate ? { buyer: c.gate.buyer } : {}) });
const score = (v: number | null) => (v === null ? "no measurement" : v.toFixed(2));
const plural = (type: string) => (type === "urn:entity:person" ? "people" : `${(TYPE_LABEL[type] ?? "entity").toLowerCase()}s`);
// a short descriptor from Qloo's tags: category words, not "2008 establishments in California"
const NOT_DESCRIPTIVE = /\bapp\b|advertising|brands|companies|enabled/i;
const descriptor = (tags: string[]) => tags.filter((t) => t.length <= 20 && !/\d/.test(t) && !NOT_DESCRIPTIVE.test(t)).slice(0, 2).join(" · ");

// initial: a share link, which opens on its reveal once the route answers (picks are indices into its names)
export default function ReviewView({ initial }: { initial?: Shared }) {
  const initCase = initial ? (CASES.find((c) => c.key === initial.caseKey) ?? null) : CASES[0];
  const [caseKey, setCaseKey] = useState<string | null>(initCase?.key ?? null);
  const [gateOn, setGateOn] = useState(initial?.gate ?? false);
  const [req, setReq] = useState<Body>(initCase ? caseBody(initCase, initial?.gate ?? false) : { seed: initial!.seed, names: initial!.names, only: "brand" });
  const pending = useRef<number[] | null>(initial?.picks.length ? initial.picks : null);
  const [res, setRes] = useState<Res | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [brief, setBrief] = useState<ReviewRow | null>(null);
  const current = useRef("");
  const prepared = CASES.find((c) => c.key === caseKey) ?? null;

  const key = JSON.stringify(req);
  useEffect(() => {
    current.current = key;
    fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: key })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (current.current !== key) return;
        if (r.ok) {
          setRes({ key, data: j });
          const want = pending.current;
          pending.current = null;
          const rows = (j as Result).groups[0]?.rows ?? [];
          const names = (JSON.parse(key) as Body).names;
          const ids = (want ?? []).flatMap((i) => rows.filter((row) => row.input === nameOf(names[i])).map((row) => row.entity.entity_id));
          if (ids.length) {
            setPicks(ids);
            setRevealed(true);
          }
          return;
        }
        const options = j.seed?.state === "ambiguous" ? (j.seed.options as Ref[]) : undefined;
        setRes({ key, data: null, error: options ? "Which one did you mean?" : (j.error ?? "That didn't work. Try again."), seedOptions: options });
      })
      .catch(() => current.current === key && setRes({ key, data: null, error: "Couldn't reach the review. Try again." }));
  }, [key]);

  const loading = !res || res.key !== key;
  const data = loading ? null : res.data;
  const group: ReviewGroup | undefined = data?.groups[0];
  // the address bar always holds the shareable link of the reveal on screen
  const indexOf = (id: string) => req.names.findIndex((n) => nameOf(n) === group?.rows.find((row) => row.entity.entity_id === id)?.input);
  const share = shareQuery({ caseKey, seed: req.seed, names: req.names, picks: picks.map(indexOf).filter((i) => i >= 0), gate: gateOn });
  useEffect(() => {
    if (revealed) window.history.replaceState(null, "", `${window.location.pathname}?${share}`);
  }, [revealed, share]);
  const start = (body: Body, nextCase: string | null) => {
    window.history.replaceState(null, "", window.location.pathname);
    pending.current = null;
    setCaseKey(nextCase);
    setGateOn(false);
    setPicks([]);
    setRevealed(false);
    setOpen(null);
    setReq(body);
  };
  const toggleGate = () => {
    if (!prepared) return;
    setGateOn(!gateOn);
    setReq(caseBody(prepared, !gateOn));
  };
  const need = Math.min(3, group?.rows.length ?? 3);

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">
      <SiteHeader href="/find" label="Find partners" />
      <section className="pt-8">
        <div className="flex flex-wrap items-center gap-x-4 text-base">
          <span className="text-ink-2">Prepared cases:</span>
          {CASES.map((c) => (
            <button key={c.key} onClick={() => start(caseBody(c, false), c.key)} className={btnQuiet} aria-current={caseKey === c.key}>
              {c.seed.name}
            </button>
          ))}
          <a href="#own" className={btnQuiet}>
            Try your own
          </a>
        </div>

        {loading && <p className="mt-10 font-mono text-sm text-ink-3 motion-safe:animate-pulse">Reading Qloo...</p>}
        {!loading && res?.error && <SeedProblem res={res} onChoose={(r) => setReq({ ...req, seed: { name: r.name, id: r.entity_id, type: r.type } })} />}

        {data && !group && <p className="mt-10 text-base text-ink-2">Qloo couldn&apos;t measure any of these names for {data.seed.name}.</p>}

        {data && group && !revealed && (
          <PickStep data={data} group={group} order={req.names.map(nameOf)} picks={picks} need={need} onToggle={(id) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p))} onReveal={() => setRevealed(true)} />
        )}

        {data && group && revealed && (
          <>
            <Reveal data={data} group={group} picks={picks} share={share} open={open} onOpen={setOpen} gate={prepared?.gate.label} gateOn={gateOn} onGate={toggleGate} onAgain={() => (setRevealed(false), setPicks([]), setOpen(null))} />
            {open && group.rows.find((r) => r.entity.entity_id === open) && (
              <Evidence data={data} group={group} row={group.rows.find((r) => r.entity.entity_id === open)!} onBrief={setBrief} />
            )}
          </>
        )}

        {data && data.notMeasured.length > 0 && (
          <p className="mt-6 text-base text-ink-2">
            Not measured:{" "}
            {data.notMeasured.map((i) => `${i.input} (${i.state === "ambiguous" ? "more than one match" : i.state === "proxy" ? "stand-in" : "no Qloo match"})`).join(", ")}
          </p>
        )}

        <p className="mt-10 border-t border-rule pt-4 text-sm text-ink-3">
          What this doesn&apos;t establish: purchases, visits, commercial eligibility, or whether the deal makes money.{" "}
          <a href="/audit" className="underline decoration-rule-strong underline-offset-4 hover:text-ink">
            How these rules did on briefs they weren&apos;t tuned on
          </a>
        </p>

        <TryOwn onRun={(body) => start(body, null)} />
      </section>

      {brief && data && (
        <BriefPanel
          key={brief.entity.entity_id}
          seed={{ entity_id: data.seed.entity_id, name: data.seed.name, type: data.seed.type, popularity: data.seed.popularity } satisfies Card}
          proxy={null}
          basedOn={[]}
          pick={{ entity_id: brief.entity.entity_id, name: brief.entity.name, type: brief.entity.type, affinity: brief.forward.value ?? 0, popularity: brief.popularity, tags: brief.entity.tags.slice(0, 5) } satisfies Pick}
          domain={brief.entity.type.replace("urn:entity:", "")}
          onDecide={() => {}}
          onClose={() => setBrief(null)}
        />
      )}
    </main>
  );
}

function SeedProblem({ res, onChoose }: { res: Res; onChoose: (r: Ref) => void }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-4 text-base">
      <span className="text-ink-2">{res.error}</span>
      {res.seedOptions?.map((o) => (
        <button key={o.entity_id + o.type} onClick={() => onChoose(o)} className={btnQuiet}>
          {o.name} ({TYPE_LABEL[o.type] ?? "Entity"})
        </button>
      ))}
    </div>
  );
}

// Step 1: the names in the order given, nothing about scores.
function PickStep({ data, group, order, picks, need, onToggle, onReveal }: { data: Result; group: ReviewGroup; order: string[]; picks: string[]; need: number; onToggle: (id: string) => void; onReveal: () => void }) {
  const rows = [...group.rows].sort((a, b) => order.indexOf(a.input) - order.indexOf(b.input));
  const label = (id: string) => group.rows.find((r) => r.entity.entity_id === id)?.input;
  return (
    <div className="mt-8">
      <h1 className="font-display text-2xl sm:text-3xl">Pick the three you&apos;d call first.</h1>
      <p className="mt-2 max-w-[60ch] text-base text-ink-2">
        {rows.length} {plural(group.type)} that could partner with {data.seed.name}. Choose before you see what the data says.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((r) => {
          const on = picks.includes(r.entity.entity_id);
          return (
            <li key={r.entity.entity_id}>
              <button onClick={() => onToggle(r.entity.entity_id)} aria-pressed={on} className={`flex h-full min-h-24 w-full flex-col rounded-lg border p-3 text-left ${on ? "border-accent bg-accent-tint" : "border-rule bg-surface hover:border-ink"}`}>
                <span className="text-base font-semibold text-ink">{r.input}</span>
                <span className="text-sm text-ink-3">{TYPE_LABEL[r.entity.type] ?? "Entity"}</span>
                {descriptor(r.entity.tags) && <span className="mt-1 text-sm text-ink-2">{descriptor(r.entity.tags)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {[0, 1, 2].slice(0, need).map((i) => (
          <span key={i} className={`inline-flex min-h-11 min-w-28 items-center rounded-md border border-dashed px-3 text-base ${picks[i] ? "border-accent text-ink" : "border-rule-strong text-ink-3"}`}>
            {picks[i] ? label(picks[i]) : `Pick ${i + 1}`}
          </span>
        ))}
        <button onClick={onReveal} disabled={picks.length < need} className={btnPrimary}>
          Show me
        </button>
      </div>
    </div>
  );
}

// Step 2: the same names twice, by fame and by measured taste. The visitor's picks stay marked in both.
function Reveal({ data, group, picks, share, open, onOpen, gate, gateOn, onGate, onAgain }: {
  data: Result; group: ReviewGroup; picks: string[]; share: string; open: string | null; onOpen: (id: string) => void; gate?: string; gateOn: boolean; onGate: () => void; onAgain: () => void;
}) {
  const row = (id: string) => group.rows.find((r) => r.entity.entity_id === id)!;
  const names = (ids: string[]) => ids.map((id) => row(id).input).join(", ");
  const { picks: top, tiedAtCutoff, noClearThree } = group.selection;
  const topGroup = group.affinityBands[0] ?? [];
  const mine = picks.filter((id) => topGroup.includes(id)).length;
  const missing = group.rows.filter((r) => r.forward.value === null);
  const leader = row(topGroup[0])?.forward.value ?? 0;
  // the headline only claims fame is flat when at most one name sits outside the best-known band
  const fameFlat = group.rows.length >= 4 && (group.popularityBands[0]?.length ?? 0) >= group.rows.length - 1 && group.affinityBands.length > 1;
  const pill = (id: string, value?: string) => <Name key={id} row={row(id)} picked={picks.includes(id)} open={open === id} value={value} onOpen={() => onOpen(id)} />;

  return (
    <div className="mt-8">
      <h1 className="font-display text-2xl sm:text-3xl">{fameFlat ? `Fame can't tell these ${WORDS[group.rows.length] ?? group.rows.length} apart. Taste can.` : "Fame and taste, side by side."}</h1>
      <p className="mt-3 max-w-[70ch] text-base text-ink-2">
        {noClearThree
          ? `No clear three: ${names(topGroup)} are all within ${data.gap} of each other.`
          : top.length
            ? `Measured top: ${names(top)}.${tiedAtCutoff.length ? ` Then a tie: ${names(tiedAtCutoff)}.` : ""}`
            : "Too few measurements to call a top group."}{" "}
        {mine} of your {picks.length} {mine === 1 ? "is" : "are"} in the top group.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {gate && (
          <button onClick={onGate} aria-pressed={gateOn} className={btnSecondary}>
            {gate}: {gateOn ? "on" : "off"}
          </button>
        )}
        <CopyLink share={share} />
        <button onClick={onAgain} className={btnQuiet}>
          Pick again
        </button>
        <a href={`/s/${data.seed.entity_id}?t=${encodeURIComponent(data.seed.type)}`} className={btnQuiet}>
          Find more partners for {data.seed.name}
        </a>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="font-display text-xl">How well known</h2>
          <p className="mt-1 text-sm text-ink-3">Qloo popularity, in bands {data.gap} wide from the best known. No order inside a band.</p>
          <ol className="mt-4 grid gap-4">
            {group.popularityBands.map((band, i) => (
              <li key={i} className="border-t border-rule pt-3">
                <p className="text-sm font-semibold text-ink-2">{i === 0 ? "Best known" : i === 1 ? "Less known" : `Less known, band ${i + 1}`}</p>
                <div className="mt-2 flex flex-wrap gap-2">{[...band].sort((a, b) => row(a).input.localeCompare(row(b).input)).map((id) => pill(id))}</div>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h2 className="font-display text-xl">How much {data.seed.name} fans lean toward them</h2>
          <p className="mt-1 text-sm text-ink-3">Measured affinity. A group is everything within {data.gap} of its strongest name.</p>
          <ol className="mt-4 grid gap-4">
            {group.affinityBands.map((band, i) => (
              <li key={i} className="border-t border-rule pt-3">
                <p className="text-sm font-semibold text-ink-2">{i === 0 ? "Top group" : `${(leader - (row(band[0]).forward.value ?? 0)).toFixed(2)} below the top`}</p>
                <div className="mt-2 flex flex-wrap gap-2">{band.map((id) => pill(id, score(row(id).forward.value)))}</div>
              </li>
            ))}
            {missing.length > 0 && (
              <li className="border-t border-rule pt-3">
                <p className="text-sm font-semibold text-ink-2">No measurement</p>
                <div className="mt-2 flex flex-wrap gap-2">{missing.map((r) => pill(r.entity.entity_id))}</div>
              </li>
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}

function CopyLink({ share }: { share: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard
      .writeText(`${window.location.origin}/?${share}`)
      .then(() => setCopied(true))
      .catch(() => {});
  return (
    <button onClick={copy} className={btnSecondary} aria-live="polite">
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

function Name({ row, picked, open, value, onOpen }: { row: ReviewRow; picked: boolean; open: boolean; value?: string; onOpen: () => void }) {
  const out = row.gate.state === "excluded";
  return (
    <button onClick={onOpen} aria-expanded={open} className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-base ${picked ? "border-accent bg-accent-tint" : "border-rule bg-surface"} ${open ? "ring-2 ring-ink" : "hover:border-ink"} ${out ? "text-ink-3" : "text-ink"}`}>
      <span className={out ? "line-through" : ""}>{row.input}</span>
      {value && <span className="text-sm tabular-nums text-ink-3">{value}</span>}
      {picked && <span className="text-xs font-medium text-accent-strong">Your pick</span>}
      {out && <Chip kind="excluded">Excluded</Chip>}
    </button>
  );
}

// Step 3: the numbers behind one name, then the brief.
function Evidence({ data, group, row, onBrief }: { data: Result; group: ReviewGroup; row: ReviewRow; onBrief: (r: ReviewRow) => void }) {
  const id = row.entity.entity_id;
  const seed = data.seed;
  const at = group.affinityBands.findIndex((b) => b.includes(id));
  const leader = group.rows.find((r) => r.entity.entity_id === group.affinityBands[0]?.[0])?.forward.value ?? null;
  const pop = group.popularityBands.findIndex((b) => b.includes(id));
  const rk = data.ranks[id] ?? {};
  const facts: string[] = [];
  facts.push(`${seed.name} fans toward ${row.input}: ${score(row.forward.value)}`);
  if (row.forward.value !== null && leader !== null) facts.push(leader === row.forward.value ? "The strongest measured name" : `${at === 0 ? "In the top group" : `Group ${at + 1}`}, ${(leader - row.forward.value).toFixed(2)} below the strongest`);
  facts.push(`Popularity ${row.popularity.toFixed(2)}, band ${pop + 1} of ${group.popularityBands.length}`);
  if (rk.amongSeedFans !== undefined) facts.push(rk.amongSeedFans ? `#${rk.amongSeedFans} among ${seed.name} fans' ${plural(row.entity.type)}` : `Outside ${seed.name} fans' top 50 ${plural(row.entity.type)}`);
  if (rk.seedAmongTheirs !== undefined) facts.push(rk.seedAmongTheirs ? `${seed.name} is #${rk.seedAmongTheirs} among ${row.input} fans' ${plural(seed.type)}` : `${seed.name} is outside ${row.input} fans' top 50 ${plural(seed.type)}`);
  if (row.reverse.value !== null) facts.push(`${row.input} fans toward ${seed.name}: ${score(row.reverse.value)}`);
  else if (row.reverse.sameAsForward) facts.push(`Same type as ${seed.name}, so Qloo's score is the same both ways`);

  return (
    <aside className="mt-8 rounded-lg border border-rule bg-surface p-4 sm:p-6" aria-live="polite">
      <p className="text-sm text-ink-3">{TYPE_LABEL[row.entity.type] ?? "Entity"}</p>
      <h3 className="font-display text-xl">{row.input}</h3>
      <p className="mt-1 text-base text-ink-2">Reading: {row.evidence}.</p>
      {row.gate.state !== "eligible" && <p className="mt-1 text-base text-ink-2">{row.gate.state === "excluded" ? `Excluded: ${row.gate.reason}.` : `Gate unknown: ${row.gate.reason}.`}</p>}
      <ul className="mt-3 grid gap-1 text-base text-ink">
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <button onClick={() => onBrief(row)} className={`${btnPrimary} mt-4`}>
        Open brief
      </button>
    </aside>
  );
}

// Your own seed and up to eight brand names, through the same route. Shows the most it can cost before it runs.
function TryOwn({ onRun }: { onRun: (body: Body) => void }) {
  const [seed, setSeed] = useState("");
  const [text, setText] = useState("");
  const [usage, setUsage] = useState<{ today: number; cap: number | null } | null>(null);
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
  }, []);
  const names = [...new Set(text.split("\n").map((l) => l.trim()).filter(Boolean))];
  const most = names.length ? 2 * names.length + 2 : 0; // seed search, a search per name, one forward call, a reverse call per name across types
  return (
    <form
      id="own"
      onSubmit={(e) => {
        e.preventDefault();
        if (seed.trim() && names.length && names.length <= MAX) onRun({ seed: seed.trim(), names, only: "brand" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="mt-12 grid max-w-[760px] gap-4"
    >
      <h2 className="font-display text-xl">Try your own</h2>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-ink">A brand, artist or show</span>
        <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Liquid Death" className={field} maxLength={100} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-ink">Up to eight brands, one per line</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={"Dr. Squatch\nYeti\nPoppi"} className={`${field} py-2`} />
      </label>
      <p className="text-sm text-ink-3">
        {names.length > MAX ? `That's ${names.length} names; the limit is ${MAX}.` : most ? `Up to ${most} Qloo calls; names already looked up cost nothing.` : "Each name costs a Qloo lookup the first time."}
        {usage && ` Today: ${usage.today}${usage.cap ? ` of ${usage.cap}` : ""} calls used.`}
      </p>
      <button type="submit" disabled={!seed.trim() || !names.length || names.length > MAX} className={`${btnPrimary} justify-self-start`}>
        Check these
      </button>
    </form>
  );
}
