// Share-link shape checks, shared by proxy.ts (before render, so malformed links get a real 404) and the page gates.
// No server imports: proxy runs before the app.
import { parseNames } from "./triage.ts";
import { CATEGORIES } from "./constellation-cases.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ["brand", "artist", "tv_show", "movie", "person"].map((t) => `urn:entity:${t}`); // = RESOLVE_TYPES in lib/qloo.ts

// true when the path is a share link with a valid shape; null when the path isn't a share link at all.
export function validShareLink(pathname: string, q: URLSearchParams): boolean | null {
  const s = /^\/s\/([^/]+)\/?$/.exec(pathname);
  if (s) return s[1] === "p" ? null : UUID.test(s[1]) && TYPES.includes(q.get("t") ?? "");
  const p = /^\/(?:pair|vs)\/([^/]+)\/([^/]+)\/?$/.exec(pathname); // /vs (rivals, Oct 13 row) shares the pair shape
  if (p) return UUID.test(p[1]) && UUID.test(p[2]) && p[1] !== p[2] && TYPES.includes(q.get("ta") ?? "") && TYPES.includes(q.get("tb") ?? "");
  const m = /^\/map\/([^/]+)\/?$/.exec(pathname); // category maps: only the prepared slugs exist
  if (m) return CATEGORIES.some((c) => c.slug === m[1]);
  const t = /^\/triage\/([^/]+)\/?$/.exec(pathname);
  if (t) return UUID.test(t[1]) && TYPES.includes(q.get("t") ?? "") && parseNames(q.get("n")) !== null;
  // an ask and its sheet: the id must be a Qloo id (a cached ask has to resolve to it, lib/ask/body.ts), and
  // a type, when given, one the resolver knows; ?q= and ?case= links carry their own body
  const a = /^\/ask\/([^/]+)(?:\/sheet)?\/?$/.exec(pathname);
  if (a) return UUID.test(a[1]) && (q.has("q") || q.has("case") || !q.has("t") || TYPES.includes(q.get("t") ?? ""));
  return null;
}
