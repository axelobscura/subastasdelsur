/**
 * Settling ended auctions and sending bid notifications (phase 6).
 *
 * - settleAuction claims an auction with one atomic UPDATE … WHERE settled_at IS NULL, so it
 *   runs exactly once even if the worker, a page view and a second process race (pm2 reload).
 * - Results themselves are always derived from the bids (lotOutcome); settling only sends the
 *   emails and stamps settled_at.
 *
 * No `server-only` guard: the worker (instrumentation) and DB tests use it.
 */
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { auction, bid, notification, product, user } from "./db/schema";
import { dbNow } from "./db/time";
import { type Email, sendEmail } from "./email/send";
import { adminAuctionSummaryTemplate, appUrl, auctionResultTemplate, type EmailLot, outbidTemplate } from "./email/templates";
import { formatMoney } from "./money";
import { type Person, type SettlementLot, planSettlement, shouldSendOutbidEmail } from "./settlement";
import { formatAuctionTimeShort } from "./time";

type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Every lot of an auction with its leader and all its bidders. */
export async function loadSettlementLots(db: Executor, auctionId: string): Promise<SettlementLot[]> {
  const products = await db
    .select({
      productId: product.id,
      lotNumber: product.lotNumber,
      title: product.title,
      bidCount: product.bidCount,
      currentPriceCents: product.currentPriceCents,
      reservePriceCents: product.reservePriceCents,
      leadingBidId: product.leadingBidId,
    })
    .from(product)
    .where(eq(product.auctionId, auctionId))
    .orderBy(asc(product.lotNumber));
  if (!products.length) return [];

  const rows = await db
    .select({ bidId: bid.id, productId: bid.productId, userId: user.id, name: user.name, email: user.email, phone: user.phone })
    .from(bid)
    .innerJoin(user, eq(user.id, bid.userId))
    .where(inArray(bid.productId, products.map((p) => p.productId)))
    .orderBy(asc(bid.createdAt));

  return products.map((p) => {
    const own = rows.filter((r) => r.productId === p.productId);
    const bidders = new Map<string, Person>();
    for (const r of own) bidders.set(r.userId, { userId: r.userId, name: r.name, email: r.email, phone: r.phone });
    const leaderRow = own.find((r) => r.bidId === p.leadingBidId);
    return {
      productId: p.productId,
      lotNumber: p.lotNumber,
      title: p.title,
      bidCount: p.bidCount,
      currentPriceCents: p.currentPriceCents,
      reservePriceCents: p.reservePriceCents,
      leader: leaderRow ? bidders.get(leaderRow.userId)! : null,
      bidders: [...bidders.values()],
    };
  });
}

export type SettleResult = { settled: false } | { settled: true; emailed: number; failed: number; summary: ReturnType<typeof planSettlement>["summary"] };

/**
 * `graceMs`: only settle if the auction ended at least this long ago (the worker uses 60 s, so a
 * bid sent at the closing instant lands first, and tests can settle and delete their own [TEST]
 * auctions before the production worker ever sees them).
 */
export async function settleAuction(db: Db, auctionId: string, { graceMs = 0 }: { graceMs?: number } = {}): Promise<SettleResult> {
  // Claim it: only one caller ever gets affectedRows = 1.
  const [claim] = await db.execute(sql`
    UPDATE auction SET settled_at = UTC_TIMESTAMP(3)
    WHERE id = ${auctionId} AND status = 'published' AND settled_at IS NULL
      AND ends_at <= UTC_TIMESTAMP(3) - INTERVAL ${graceMs * 1000} MICROSECOND`);
  if ((claim as unknown as { affectedRows: number }).affectedRows !== 1) return { settled: false };

  const [info] = await db.select({ title: auction.title, slug: auction.slug, timezone: auction.timezone }).from(auction).where(eq(auction.id, auctionId));
  const plan = planSettlement(await loadSettlementLots(db, auctionId));
  const toEmailLot = (lot: SettlementLot): EmailLot => ({
    lotNumber: lot.lotNumber,
    title: lot.title,
    amount: lot.currentPriceCents === null ? "sin pujas" : formatMoney(lot.currentPriceCents),
    url: appUrl(`/subastas/${info.slug}/${lot.lotNumber}`),
  });

  let emailed = 0;
  let failed = 0;
  const send = async (template: string, to: string, content: Omit<Email, "to">) => {
    try {
      await sendEmail({ to, ...content });
      emailed++;
    } catch (error) {
      failed++;
      console.error(`[settlement] email failed template=${template} to=${to}: ${error instanceof Error ? error.message : error}`);
    }
  };

  const now = await dbNow(db);
  for (const bidder of plan.bidders) {
    await send(
      "auction-result",
      bidder.email,
      auctionResultTemplate({
        name: bidder.name,
        auctionTitle: info.title,
        won: bidder.won.map(toEmailLot),
        reserveNotMet: bidder.reserveNotMet.map(toEmailLot),
        notWon: bidder.notWon.map(toEmailLot),
        accountUrl: appUrl("/mi-cuenta"),
      }),
    );
    await db.insert(notification).values({ userId: bidder.userId, kind: "auction_result", auctionId, createdAt: now });
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    await send(
      "admin-summary",
      adminEmail,
      adminAuctionSummaryTemplate({ auctionTitle: info.title, ...plan.summary, total: formatMoney(plan.summary.totalSoldCents), resultsUrl: appUrl(`/admin/subastas/${auctionId}/resultados`) }),
    );
    await db.insert(notification).values({ email: adminEmail, kind: "admin_summary", auctionId, createdAt: now });
  }

  console.info(`[settlement] settled auction=${auctionId} sold=${plan.summary.sold}/${plan.summary.lots} emailed=${emailed} failed=${failed}`);
  return { settled: true, emailed, failed, summary: plan.summary };
}

export const WORKER_GRACE_MS = 60_000;

/** Settle every published auction that ended over a minute ago and isn't settled yet (the worker). */
export async function settleDueAuctions(db: Db): Promise<number> {
  const due = await db
    .select({ id: auction.id })
    .from(auction)
    .where(and(eq(auction.status, "published"), isNull(auction.settledAt), lte(auction.endsAt, sql`UTC_TIMESTAMP(3) - INTERVAL ${WORKER_GRACE_MS * 1000} MICROSECOND`)))
    .limit(20);
  let settled = 0;
  for (const { id } of due) if ((await settleAuction(db, id, { graceMs: WORKER_GRACE_MS })).settled) settled++;
  return settled;
}

/**
 * Tell the previous leader they were outbid, at most once every 10 minutes per lot
 * (shouldSendOutbidEmail). Called after a bid is accepted.
 */
export async function notifyOutbid(db: Db, input: { productId: string; previousLeaderId: string }): Promise<boolean> {
  const now = await dbNow(db);
  const [last] = await db
    .select({ at: sql<string>`MAX(${notification.createdAt})` })
    .from(notification)
    .where(and(eq(notification.userId, input.previousLeaderId), eq(notification.productId, input.productId), eq(notification.kind, "outbid")));
  const lastAt = last?.at ? new Date(`${String(last.at).replace(" ", "T")}Z`) : null;
  if (!shouldSendOutbidEmail(lastAt, now)) return false;

  const [row] = await db
    .select({
      name: user.name,
      email: user.email,
      lotNumber: product.lotNumber,
      title: product.title,
      currentPriceCents: product.currentPriceCents,
      auctionId: auction.id,
      auctionTitle: auction.title,
      slug: auction.slug,
      endsAt: auction.endsAt,
      timezone: auction.timezone,
    })
    .from(product)
    .innerJoin(auction, eq(auction.id, product.auctionId))
    .innerJoin(user, eq(user.id, input.previousLeaderId))
    .where(eq(product.id, input.productId));
  if (!row) return false;

  await db.insert(notification).values({ userId: input.previousLeaderId, kind: "outbid", auctionId: row.auctionId, productId: input.productId, createdAt: now });
  await sendEmail({
    to: row.email,
    ...outbidTemplate({
      name: row.name,
      auctionTitle: row.auctionTitle,
      endsAt: formatAuctionTimeShort(row.endsAt, row.timezone),
      lot: { lotNumber: row.lotNumber, title: row.title, amount: formatMoney(row.currentPriceCents ?? 0), url: appUrl(`/subastas/${row.slug}/${row.lotNumber}`) },
    }),
  });
  return true;
}

/** Everyone who bid in an auction (for the cancellation notice). */
export async function auctionBidders(db: Executor, auctionId: string): Promise<Person[]> {
  const rows = await db
    .selectDistinct({ userId: user.id, name: user.name, email: user.email })
    .from(bid)
    .innerJoin(product, eq(product.id, bid.productId))
    .innerJoin(user, eq(user.id, bid.userId))
    .where(eq(product.auctionId, auctionId));
  return rows;
}
