import { type NextRequest } from "next/server";
import { proposeProxies } from "@/lib/proxy.ts";

// POST /api/proxies {name, description, brands: string[]} -> { proxies: Card[], rejected: [{name, reason}], proposed }
// The user's named brands are tried first; Haiku 5.5 proposes the rest; every candidate goes through match validation.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "";
  const brands: string[] = Array.isArray(body.brands) ? body.brands.filter((b: unknown) => typeof b === "string").map((b: string) => b.slice(0, 80)) : [];
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  try {
    const result = await proposeProxies(name, description, brands);
    console.log(`[proxies] "${name}" proposed ${result.proposed.join(", ") || "none"}; verified ${result.proxies.map((p) => p.name).join(", ") || "none"}`);
    return Response.json(result);
  } catch (err) {
    console.error("[proxies]", err);
    return Response.json({ error: "Couldn't check those brands right now" }, { status: 502 });
  }
}
