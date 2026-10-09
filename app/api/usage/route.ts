import { connection } from "next/server";
import { qlooUsage, qlooToday } from "@/lib/qloo.ts";

// GET /api/usage -> live Qloo calls today across all instances (from Redis), the daily cap, the month quota left
// as of the last Qloo response, and this instance's own count.
export async function GET() {
  await connection(); // always run at request time, never prerendered
  const { calls } = qlooUsage();
  return Response.json({ ...(await qlooToday()), thisInstance: calls }, { headers: { "Cache-Control": "no-store" } });
}
