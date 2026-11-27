/**
 * Read-only connection check: `npm run db:check` (needs `npm run db:tunnel` locally).
 * Prints the server version, session timezone and clocks. Writes nothing.
 */
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { createDb, createPool } from "../lib/db/client";

loadEnvConfig(process.cwd());

async function main() {
  const pool = createPool();
  const db = createDb(pool);

  try {
    const [rows] = await pool.query(
      `SELECT VERSION() AS version, DATABASE() AS db, @@session.time_zone AS session_tz,
              @@system_time_zone AS system_tz, @@default_storage_engine AS engine,
              DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ') AS db_utc_now`,
    );
    const info = (rows as Record<string, unknown>[])[0];
    const tables = await db.execute(
      sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name`,
    );
    console.log({
      ...info,
      local_utc_now: new Date().toISOString(),
      tables: (tables[0] as unknown as { name: string }[]).map((t) => t.name),
    });
    if (info.session_tz !== "+00:00") {
      console.error("Session time_zone is not UTC: check lib/db/client.ts");
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
