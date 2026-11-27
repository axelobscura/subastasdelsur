import "server-only";
import { connection } from "next/server";

/**
 * The server time of the current request, for display (phase badges, countdown start, which list
 * an auction goes in). Marks the render as per-request (`connection()`), so it's never baked into
 * a cached or prerendered page. Decisions that matter (bids, publishing) use the DB clock (`dbNow`).
 */
export async function requestTime(): Promise<Date> {
  await connection();
  return new Date();
}
