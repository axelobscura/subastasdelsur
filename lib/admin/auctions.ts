/**
 * Admin data access for auctions (reads). Every function checks `requireAdmin()` itself.
 * Mutations are in app/admin/subastas/actions.ts.
 */
import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "../dal";
import { type Auction, auction, getDb, product, productImage } from "../db";
import { dbNow } from "../db/time";

export type AdminAuctionRow = Auction & { productCount: number };

const productCount = sql<number>`(SELECT COUNT(*) FROM ${product} WHERE ${product.auctionId} = ${auction.id})`.mapWith(Number);

export async function listAuctions(): Promise<{ auctions: AdminAuctionRow[]; now: Date }> {
  await requireAdmin("/admin/subastas");
  const db = getDb();
  const [rows, now] = await Promise.all([
    db
      .select({ auction, productCount })
      .from(auction)
      .orderBy(desc(auction.startsAt))
      .limit(500),
    dbNow(db),
  ]);
  return { auctions: rows.map((r) => ({ ...r.auction, productCount: r.productCount })), now };
}

export type AdminAuctionDetail = Auction & { productCount: number; productsWithoutImages: number; createdByName: string | null };

export async function getAuctionForAdmin(id: string): Promise<{ auction: AdminAuctionDetail; now: Date } | null> {
  await requireAdmin(`/admin/subastas/${id}`);
  const db = getDb();
  const [[row], now] = await Promise.all([
    db
      .select({
        auction,
        productCount,
        productsWithoutImages: sql<number>`(
          SELECT COUNT(*) FROM ${product}
          WHERE ${product.auctionId} = ${auction.id}
            AND NOT EXISTS (SELECT 1 FROM ${productImage} WHERE ${productImage.productId} = ${product.id})
        )`.mapWith(Number),
        createdByName: sql<string | null>`(SELECT name FROM \`user\` WHERE id = ${auction.createdBy})`,
      })
      .from(auction)
      .where(eq(auction.id, id)),
    dbNow(db),
  ]);
  if (!row) return null;
  return {
    auction: { ...row.auction, productCount: row.productCount, productsWithoutImages: row.productsWithoutImages, createdByName: row.createdByName },
    now,
  };
}

/** Counts for the dashboard, by display state. */
export async function auctionCounts(): Promise<Record<"draft" | "upcoming" | "live" | "ended" | "cancelled", number>> {
  await requireAdmin();
  const db = getDb();
  const [rows] = await db.execute(sql`
    SELECT
      SUM(status = 'draft') AS draft,
      SUM(status = 'cancelled') AS cancelled,
      SUM(status = 'published' AND starts_at > UTC_TIMESTAMP(3)) AS upcoming,
      SUM(status = 'published' AND starts_at <= UTC_TIMESTAMP(3) AND ends_at > UTC_TIMESTAMP(3)) AS live,
      SUM(status = 'published' AND ends_at <= UTC_TIMESTAMP(3)) AS ended
    FROM ${auction}`);
  const r = (rows as unknown as Record<string, string | null>[])[0] ?? {};
  const n = (v: string | null | undefined) => Number(v ?? 0);
  return { draft: n(r.draft), upcoming: n(r.upcoming), live: n(r.live), ended: n(r.ended), cancelled: n(r.cancelled) };
}
