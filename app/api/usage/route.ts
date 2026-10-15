import { connection } from "next/server";
import { qlooUsage, qlooToday } from "@/lib/qloo.ts";

// GET /api/usage -> live Qloo calls today across all instances (from Redis), the daily cap, the month quota left
// as of the last Qloo response, this instance's own count, and the deployed commit (deploy checks, Oct 15).
export async function GET() {
  await connection(); // always run at request time, never prerendered
  const { calls } = qlooUsage();
  return Response.json({ ...(await qlooToday()), thisInstance: calls, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null }, { headers: { "Cache-Control": "no-store" } });
}
