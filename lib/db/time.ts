import { sql } from "drizzle-orm";
import type { Db } from "./client";

type Executor = Pick<Db, "execute">;

/**
 * The database's current time: the single clock for "has it started / ended?" decisions
 * (PLAN timezone rule 4). Pass a transaction to read it inside one.
 * UNIX_TIMESTAMP(NOW(3)) is the true epoch whatever the session zone, because both convert
 * through the same zone.
 */
export async function dbNow(executor: Executor): Promise<Date> {
  const [rows] = await executor.execute(sql`SELECT UNIX_TIMESTAMP(NOW(3)) AS t`);
  const t = Number((rows as unknown as { t: string | number }[])[0].t);
  return new Date(Math.round(t * 1000));
}
