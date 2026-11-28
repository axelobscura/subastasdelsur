import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

// For uptime monitors: 200 when the app and the database answer, 503 otherwise. Never cached.
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([getDb().execute(sql`SELECT 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))]);
    return Response.json({ ok: true, db: "ok", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
