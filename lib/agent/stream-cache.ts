// Caching a streamed generation (briefs, outreach emails).
// unstable_cache can't hold a stream, so the cached function does the generation itself and forwards tokens to
// whichever request is waiting on that key. A cache hit skips the function; the caller replays the stored result.
// ponytail: one listener per key, so two simultaneous first-time requests for the same key stream to the later
// one only; the earlier gets the full text when it finishes. Fine for a demo.
import { cached } from "../qloo.ts";

export type Listener = { ip: string; ran: boolean; trace: (t: string) => void; text: (d: string) => void };
export type Streamed = { text: string; trace: string[] };

// ponytail: per-instance, in-memory, resets on cold start, so the real ceiling is 20 x live instances per IP.
// Upgrade path: a KV counter (Upstash or Vercel KV) keyed by ip:date. Counts fresh generations only.
const DAILY_CAP = 20;
const usageByIp = new Map<string, { day: string; n: number }>();
export class CapReached extends Error {}
function spend(ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const u = usageByIp.get(ip);
  const n = u?.day === day ? u.n : 0;
  if (n >= DAILY_CAP) throw new CapReached();
  usageByIp.set(ip, { day, n: n + 1 });
}

export function streamCache<I, R extends Streamed>(name: string, version: string, keyOf: (i: I) => string, gen: (i: I, say: (t: string) => void, write: (d: string) => void) => Promise<R>) {
  const listeners = new Map<string, Listener>();
  const run = cached(name, async (_v: string, input: I): Promise<R> => {
    const l = listeners.get(keyOf(input));
    if (l) l.ran = true;
    spend(l?.ip ?? "unknown");
    return gen(
      input,
      (t) => l?.trace(t),
      (d) => l?.text(d),
    );
  });
  // Live tokens go to onTrace/onText; on a cache hit the result comes back with ran=false for the caller to replay.
  return async (input: I, ip: string, onTrace: (t: string) => void, onText: (d: string) => void): Promise<R & { ran: boolean }> => {
    const l: Listener = { ip, ran: false, trace: onTrace, text: onText };
    const key = keyOf(input);
    listeners.set(key, l);
    try {
      return { ...(await run(version, input)), ran: l.ran };
    } finally {
      if (listeners.get(key) === l) listeners.delete(key);
    }
  };
}
