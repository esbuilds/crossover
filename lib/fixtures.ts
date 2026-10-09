// Development only: serve the recorded demo entities (fixtures/demo, gitignored) so UI work spends no quota.
// Production never reads these; on Vercel the 30-day cache does the same job after one warm pass.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Entity, HeatCell } from "./qloo.ts";
import { tokens, type Resolution } from "./resolve.ts";
import type { Slate } from "./slate.ts";

type Fixture = { query: string; candidates: Entity[]; resolution: Resolution; slate: Slate; heatmap: HeatCell[] };

let loaded: Fixture[] | null = null;
function all(): Fixture[] {
  if (process.env.NODE_ENV !== "development") return [];
  if (!loaded) {
    const dir = join(process.cwd(), "fixtures", "demo");
    try {
      loaded = readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
    } catch {
      loaded = []; // fresh clone: no fixtures, fall through to live Qloo
    }
  }
  return loaded;
}

const idOf = (f: Fixture) => (f.resolution.status === "confident" ? f.resolution.match.entity_id : null);

export const fixtureById = (id: string) => all().find((f) => idOf(f) === id);
export const fixtureByQuery = (q: string) => all().find((f) => tokens(f.query).join(" ") === tokens(q).join(" "));
