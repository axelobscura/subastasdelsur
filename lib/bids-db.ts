/**
 * Placing bids and reading a lot's live state. The database clock decides (PLAN timezone
 * rule 4); the product row lock serializes bids on one lot.
 *
 * No `server-only` guard: DB tests call these with a transaction.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import { type BidError, bidProblem, bidderLabels, minimumBid } from "./bids";
import type { Db } from "./db/client";
import { auction, bid, product } from "./db/schema";
import { dbNow } from "./db/time";
import { auctionPhase, type AuctionPhase } from "./time";

type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type PlaceBidResult = { ok: true; bidId: string; amountCents: number } | { ok: false; error: BidError };

/**
 * Accept or reject one bid. In one transaction: lock the product row (FOR UPDATE), read the
 * DB clock, check the rules, then insert the bid and update the lot's price and leader.
 * Concurrent bids on the same lot wait for the lock and are checked against the new price.
 */
export async function placeBidCore(db: Executor, input: { productId: string; userId: string; amountCents: number }): Promise<PlaceBidResult> {
  return db.transaction(async (tx) => {
    // Lock only the product row (MariaDB has no FOR UPDATE OF), then read its auction.
    const [lot] = await tx
      .select({
        auctionId: product.auctionId,
        startingPriceCents: product.startingPriceCents,
        minIncrementCents: product.minIncrementCents,
        currentPriceCents: product.currentPriceCents,
        bidCount: product.bidCount,
        leadingBidId: product.leadingBidId,
      })
      .from(product)
      .where(eq(product.id, input.productId))
      .for("update");
    if (!lot) return { ok: false, error: "not_found" };
    const [owner] = await tx.select({ status: auction.status, startsAt: auction.startsAt, endsAt: auction.endsAt }).from(auction).where(eq(auction.id, lot.auctionId));
    if (!owner) return { ok: false, error: "not_found" };

    const now = await dbNow(tx);
    let leadingBidderId: string | null = null;
    if (lot.leadingBidId) {
      const [leading] = await tx.select({ userId: bid.userId }).from(bid).where(eq(bid.id, lot.leadingBidId));
      leadingBidderId = leading?.userId ?? null;
    }

    const problem = bidProblem({ auction: owner, lot, amountCents: input.amountCents, bidderId: input.userId, leadingBidderId, now });
    if (problem) return { ok: false, error: problem };

    const bidId = crypto.randomUUID();
    await tx.insert(bid).values({ id: bidId, productId: input.productId, userId: input.userId, amountCents: input.amountCents, createdAt: now });
    await tx
      .update(product)
      .set({ currentPriceCents: input.amountCents, leadingBidId: bidId, bidCount: sql`${product.bidCount} + 1` })
      .where(eq(product.id, input.productId));
    return { ok: true, bidId, amountCents: input.amountCents };
  });
}

export type LotHistoryEntry = { label: string; amountCents: number; at: number; isYou: boolean };

/** Everything the lot page shows live. Never cached. Bidders appear only as "Postor N". */
export type LotState = {
  productId: string;
  serverNow: number;
  startsAt: number;
  endsAt: number;
  status: "draft" | "published" | "cancelled";
  phase: AuctionPhase;
  startingPriceCents: number;
  minIncrementCents: number;
  currentPriceCents: number | null;
  bidCount: number;
  minimumNextCents: number;
  /** Whether a reserve exists and is met. The amount itself is never shown. */
  reserve: "none" | "met" | "not_met";
  /** Only for a signed-in viewer. */
  you: { isLeading: boolean; hasBid: boolean } | null;
  history: LotHistoryEntry[];
};

export async function getLotState(db: Executor, productId: string, viewerId: string | null, historyLimit = 15): Promise<LotState | null> {
  const [row] = await db
    .select({
      auctionId: product.auctionId,
      startingPriceCents: product.startingPriceCents,
      minIncrementCents: product.minIncrementCents,
      currentPriceCents: product.currentPriceCents,
      reservePriceCents: product.reservePriceCents,
      bidCount: product.bidCount,
      leadingBidId: product.leadingBidId,
      status: auction.status,
      startsAt: auction.startsAt,
      endsAt: auction.endsAt,
    })
    .from(product)
    .innerJoin(auction, eq(auction.id, product.auctionId))
    .where(eq(product.id, productId));
  if (!row) return null;

  const [now, recent, firstBids] = await Promise.all([
    dbNow(db),
    db.select({ id: bid.id, userId: bid.userId, amountCents: bid.amountCents, createdAt: bid.createdAt }).from(bid).where(eq(bid.productId, productId)).orderBy(desc(bid.amountCents)).limit(historyLimit),
    db
      .select({ userId: bid.userId, first: sql<string>`MIN(${bid.createdAt})` })
      .from(bid)
      .where(eq(bid.productId, productId))
      .groupBy(bid.userId)
      .orderBy(asc(sql`MIN(${bid.createdAt})`)),
  ]);
  const labels = bidderLabels(firstBids);
  const leader = recent.find((b) => b.id === row.leadingBidId);
  const youBid = viewerId ? firstBids.some((b) => b.userId === viewerId) : false;

  return {
    productId,
    serverNow: now.getTime(),
    startsAt: row.startsAt.getTime(),
    endsAt: row.endsAt.getTime(),
    status: row.status,
    phase: auctionPhase(row.startsAt, row.endsAt, now),
    startingPriceCents: row.startingPriceCents,
    minIncrementCents: row.minIncrementCents,
    currentPriceCents: row.currentPriceCents,
    bidCount: row.bidCount,
    minimumNextCents: minimumBid(row),
    reserve: row.reservePriceCents === null ? "none" : (row.currentPriceCents ?? 0) >= row.reservePriceCents ? "met" : "not_met",
    you: viewerId ? { isLeading: leader?.userId === viewerId, hasBid: youBid } : null,
    history: recent.map((b) => ({ label: labels.get(b.userId) ?? "Postor", amountCents: b.amountCents, at: b.createdAt.getTime(), isYou: b.userId === viewerId })),
  };
}

/** Current price and bid count for every lot of an auction (lot cards). */
export async function getAuctionLiveSummary(db: Executor, auctionId: string): Promise<Map<string, { currentPriceCents: number | null; bidCount: number }>> {
  const rows = await db.select({ id: product.id, currentPriceCents: product.currentPriceCents, bidCount: product.bidCount }).from(product).where(eq(product.auctionId, auctionId));
  return new Map(rows.map((r) => [r.id, { currentPriceCents: r.currentPriceCents, bidCount: r.bidCount }]));
}
