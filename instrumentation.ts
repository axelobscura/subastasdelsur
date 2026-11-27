// Runs once when a Next.js server starts. Starts the auction settlement worker in production only
// (SETTLEMENT_WORKER=1 in /srv/nextjs/shared/.env.production); see lib/settlement-worker.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SETTLEMENT_WORKER === "1") {
    const { startSettlementWorker } = await import("./lib/settlement-worker");
    startSettlementWorker();
  }
}
