/** "Mis pujas": the lots a bidder has bid on and how they stand. */
import "server-only";
import { and, desc, eq, max } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { type MyLotStatus, myLotStatus } from "./bids";
import { auction, bid, getDb, product } from "./db";
import { dbNow } from "./db/time";

export type MyLot = {
  productId: string;
  lotNumber: number;
  productTitle: string;
  auctionSlug: string;
  auctionTitle: string;
  timezone: string;
  endsAt: Date;
  myHighestCents: number;
  currentPriceCents: number | null;
  status: MyLotStatus;
};

export async function getMyLots(userId: string): Promise<MyLot[]> {
  const db = getDb();
  const leading = alias(bid, "leading_bid");
  const [rows, now] = await Promise.all([
    db
      .select({
        productId: product.id,
        lotNumber: product.lotNumber,
        productTitle: product.title,
        currentPriceCents: product.currentPriceCents,
        reservePriceCents: product.reservePriceCents,
        auctionSlug: auction.slug,
        auctionTitle: auction.title,
        auctionStatus: auction.status,
        startsAt: auction.startsAt,
        endsAt: auction.endsAt,
        timezone: auction.timezone,
        leaderId: leading.userId,
        myHighestCents: max(bid.amountCents),
      })
      .from(bid)
      .innerJoin(product, eq(product.id, bid.productId))
      .innerJoin(auction, eq(auction.id, product.auctionId))
      .leftJoin(leading, eq(leading.id, product.leadingBidId))
      .where(and(eq(bid.userId, userId)))
      .groupBy(
        product.id,
        product.lotNumber,
        product.title,
        product.currentPriceCents,
        product.reservePriceCents,
        auction.slug,
        auction.title,
        auction.status,
        auction.startsAt,
        auction.endsAt,
        auction.timezone,
        leading.userId,
      )
      .orderBy(desc(auction.endsAt), product.lotNumber)
      .limit(200),
    dbNow(db),
  ]);

  return rows.map((r) => ({
    productId: r.productId,
    lotNumber: r.lotNumber,
    productTitle: r.productTitle,
    auctionSlug: r.auctionSlug,
    auctionTitle: r.auctionTitle,
    timezone: r.timezone,
    endsAt: r.endsAt,
    myHighestCents: Number(r.myHighestCents ?? 0),
    currentPriceCents: r.currentPriceCents,
    status: myLotStatus({
      auction: { status: r.auctionStatus, startsAt: r.startsAt, endsAt: r.endsAt },
      isLeading: r.leaderId === userId,
      currentPriceCents: r.currentPriceCents,
      reservePriceCents: r.reservePriceCents,
      now,
    }),
  }));
}
