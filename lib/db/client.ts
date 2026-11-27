/**
 * Database connection without the `server-only` guard, so scripts and DB tests can
 * use it. App code imports `@/lib/db` instead.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export function createPool(url = process.env.DATABASE_URL): mysql.Pool {
  if (!url) throw new Error("DATABASE_URL is not set (see .env.local / docs/PLAN.md Environments)");
  const pool = mysql.createPool({
    uri: url,
    // How mysql2 converts JS Dates in raw queries. Drizzle's own datetime columns are
    // already mapped as UTC strings.
    timezone: "Z",
    connectionLimit: 10,
    waitForConnections: true,
    enableKeepAlive: true,
  });
  // Pin every session to UTC, so NOW()/CURDATE() and any session-zone conversion agree
  // with the UTC data. Bid timing still uses UTC_TIMESTAMP(3) explicitly (PLAN rule 4).
  // Queries on a connection run in order, so this runs before the caller's first query.
  pool.pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export function createDb(pool: mysql.Pool) {
  return drizzle({ client: pool, schema, mode: "default" });
}

export type Db = ReturnType<typeof createDb>;

// One pool per process, kept across dev hot reloads.
const globalForDb = globalThis as typeof globalThis & { __subastasDb?: Db };

/** Lazily created so builds and pages that never query don't need DATABASE_URL. */
export function getDb(): Db {
  globalForDb.__subastasDb ??= createDb(createPool());
  return globalForDb.__subastasDb;
}
