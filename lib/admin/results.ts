/** Admin view of an auction's results (live while it runs, final once it ends). */
import "server-only";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../dal";
import { auction, getDb } from "../db";
import { dbNow } from "../db/time";
import { type LotOutcome, type SettlementLot, lotOutcome, planSettlement } from "../settlement";
import { loadSettlementLots } from "../settlement-db";
import { auctionPhase, type AuctionPhase } from "../time";

export type AuctionResults = {
  auction: { id: string; title: string; slug: string; status: string; timezone: string; endsAt: Date; settledAt: Date | null };
  phase: AuctionPhase;
  lots: (SettlementLot & { outcome: LotOutcome })[];
  summary: ReturnType<typeof planSettlement>["summary"];
};

export async function getAuctionResults(auctionId: string): Promise<AuctionResults | null> {
  await requireAdmin(`/admin/subastas/${auctionId}/resultados`);
  const db = getDb();
  const [row] = await db
    .select({ id: auction.id, title: auction.title, slug: auction.slug, status: auction.status, timezone: auction.timezone, startsAt: auction.startsAt, endsAt: auction.endsAt, settledAt: auction.settledAt })
    .from(auction)
    .where(eq(auction.id, auctionId));
  if (!row) return null;
  const [lots, now] = await Promise.all([loadSettlementLots(db, auctionId), dbNow(db)]);
  const { startsAt, ...info } = row;
  return {
    auction: info,
    phase: auctionPhase(startsAt, row.endsAt, now),
    lots: lots.map((lot) => ({ ...lot, outcome: lotOutcome(lot) })),
    summary: planSettlement(lots).summary,
  };
}
