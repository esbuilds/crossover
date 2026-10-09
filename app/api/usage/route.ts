import { connection } from "next/server";
import { qlooUsage } from "@/lib/qloo.ts";

// GET /api/usage -> Qloo calls made by this server instance, and the month quota left as of the last response.
// Each Vercel instance counts separately; monthRemaining is the account-wide number.
export async function GET() {
  await connection(); // always run at request time, never prerendered
  return Response.json(qlooUsage(), { headers: { "Cache-Control": "no-store" } });
}
