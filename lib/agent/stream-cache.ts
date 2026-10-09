// Caching a streamed generation (briefs, outreach emails).
// A cache can't hold a stream, so the cached function does the generation itself and forwards tokens to
// whichever request is waiting on that key. A cache hit skips the function; the caller replays the stored result.
// ponytail: one listener per key, so two simultaneous first-time requests for the same key stream to the later
// one only; the earlier gets the full text when it finishes. Fine for a demo.
import { cached } from "../qloo.ts";
import { incr, today } from "../redis.ts";

export type Listener = { ip: string; ran: boolean; trace: (t: string) => void; text: (d: string) => void };
export type Streamed = { text: string; trace: string[] };

// 20 fresh generations per IP per day, counted in Redis across instances (cached replays are free).
// Falls back to a per-instance count when Redis is unavailable.
const DAILY_CAP = 20;
const localByIp = new Map<string, { day: string; n: number }>();
export class CapReached extends Error {}
async function spend(ip: string) {
  const shared = await incr(`cx:count:gen:${ip}:${today()}`, 60 * 60 * 48);
  const u = localByIp.get(ip);
  const local = (u?.day === today() ? u.n : 0) + 1;
  localByIp.set(ip, { day: today(), n: local });
  if ((shared ?? local) > DAILY_CAP) throw new CapReached();
}

export function streamCache<I, R extends Streamed>(name: string, version: string | ((i: I) => string), keyOf: (i: I) => string, gen: (i: I, say: (t: string) => void, write: (d: string) => void) => Promise<R>) {
  const listeners = new Map<string, Listener>();
  const run = cached(name, async (_v: string, input: I): Promise<R> => {
    const l = listeners.get(keyOf(input));
    if (l) l.ran = true;
    await spend(l?.ip ?? "unknown");
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
      return { ...(await run(typeof version === "string" ? version : version(input), input)), ran: l.ran };
    } finally {
      if (listeners.get(key) === l) listeners.delete(key);
    }
  };
}
