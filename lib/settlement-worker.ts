/**
 * Background settlement inside the Next.js server process (started by instrumentation.ts).
 * Every 30 seconds it settles auctions that have ended. Only runs where SETTLEMENT_WORKER=1, which
 * is set in production only: development and test servers share the production DB and must never
 * email real bidders. Safe with two processes during a pm2 reload, because settleAuction claims
 * each auction atomically.
 */
import { getDb } from "./db/client";
import { settleDueAuctions } from "./settlement-db";

const INTERVAL_MS = 30_000;
const globalForWorker = globalThis as typeof globalThis & { __settlementWorker?: ReturnType<typeof setInterval> };

export function startSettlementWorker(): void {
  if (globalForWorker.__settlementWorker) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const settled = await settleDueAuctions(getDb());
      if (settled) console.info(`[settlement] worker settled ${settled} auction(s)`);
    } catch (error) {
      console.error(`[settlement] worker error: ${error instanceof Error ? error.message : error}`);
    } finally {
      running = false;
    }
  };
  globalForWorker.__settlementWorker = setInterval(tick, INTERVAL_MS);
  globalForWorker.__settlementWorker.unref?.();
  setTimeout(tick, 5_000).unref?.();
  console.info("[settlement] worker started (every 30s)");
}
