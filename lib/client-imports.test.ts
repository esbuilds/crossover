import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Oct 22 outage: a client component value-imported lib/cohort.ts, which imports the server-only Qloo client. The
// build passed and every slate page threw in the browser. This walks each "use client" file's value imports and
// fails if any of them reaches lib/qloo.ts. Type-only imports are erased, so they are fine.
const root = resolve(import.meta.dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
const valueImports = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(/^import\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)]
    .map((m) => m[1])
    .flatMap((spec) => {
      const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
      if (!base) return [];
      for (const p of [base, `${base}.ts`, `${base}.tsx`]) if (/\.tsx?$/.test(p) && statSync(p, { throwIfNoEntry: false })?.isFile()) return [p];
      return [];
    });
const reachesQloo = (file: string, seen = new Set<string>()): string | null => {
  if (file.endsWith(join("lib", "qloo.ts"))) return file;
  if (seen.has(file)) return null;
  seen.add(file);
  for (const dep of valueImports(file)) {
    const hit = reachesQloo(dep, seen);
    if (hit) return `${file.replace(root + "/", "")} -> ${hit.replace(root + "/", "")}`;
  }
  return null;
};

test("no client component pulls the server-only Qloo client into the browser", () => {
  const clients = files(join(root, "app")).filter((f) => /^["']use client["']/m.test(readFileSync(f, "utf8")));
  assert.ok(clients.length > 3);
  for (const f of clients) assert.equal(reachesQloo(f), null, `${f.replace(root + "/", "")} reaches lib/qloo.ts`);
});
