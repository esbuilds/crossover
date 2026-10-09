// Share-link shape checks, shared by proxy.ts (before render, so malformed links get a real 404) and the page gates.
// No server imports: proxy runs before the app.
import { parseNames } from "./triage.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ["brand", "artist", "tv_show", "movie", "person"].map((t) => `urn:entity:${t}`); // = RESOLVE_TYPES in lib/qloo.ts

// true when the path is a share link with a valid shape; null when the path isn't a share link at all.
export function validShareLink(pathname: string, q: URLSearchParams): boolean | null {
  const s = /^\/s\/([^/]+)\/?$/.exec(pathname);
  if (s) return s[1] === "p" ? null : UUID.test(s[1]) && TYPES.includes(q.get("t") ?? "");
  const p = /^\/pair\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (p) return UUID.test(p[1]) && UUID.test(p[2]) && p[1] !== p[2] && TYPES.includes(q.get("ta") ?? "") && TYPES.includes(q.get("tb") ?? "");
  const t = /^\/triage\/([^/]+)\/?$/.exec(pathname);
  if (t) return UUID.test(t[1]) && TYPES.includes(q.get("t") ?? "") && parseNames(q.get("n")) !== null;
  return null;
}
