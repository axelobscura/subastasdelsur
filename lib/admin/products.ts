/**
 * Admin data access for products and their photos. Every function checks `requireAdmin()`.
 * Mutations are in app/admin/subastas/[id]/productos/actions.ts.
 */
import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "../dal";
import { type Product, type ProductImage, auction, bid, getDb, product, productImage, user } from "../db";
import { productCover, productImageCount } from "../db/aggregates";

export type AdminProductRow = Product & { imageCount: number; coverKey: string | null; coverWidth: number | null; coverHeight: number | null };

export async function listProducts(auctionId: string): Promise<AdminProductRow[]> {
  await requireAdmin(`/admin/subastas/${auctionId}`);
  const rows = await getDb()
    .select({
      product,
      imageCount: productImageCount,
      coverKey: sql<string | null>`${productCover("storage_key")}`,
      coverWidth: sql<number | null>`${productCover("width")}`,
      coverHeight: sql<number | null>`${productCover("height")}`,
    })
    .from(product)
    .where(eq(product.auctionId, auctionId))
    .orderBy(asc(product.lotNumber));
  return rows.map((r) => ({
    ...r.product,
    imageCount: r.imageCount,
    coverKey: r.coverKey,
    coverWidth: r.coverWidth == null ? null : Number(r.coverWidth),
    coverHeight: r.coverHeight == null ? null : Number(r.coverHeight),
  }));
}

export async function lotNumbersInUse(auctionId: string): Promise<number[]> {
  await requireAdmin();
  const rows = await getDb().select({ lot: product.lotNumber }).from(product).where(eq(product.auctionId, auctionId));
  return rows.map((r) => r.lot);
}

export async function getProductForAdmin(auctionId: string, productId: string): Promise<{ product: Product; images: ProductImage[] } | null> {
  await requireAdmin(`/admin/subastas/${auctionId}/productos/${productId}`);
  const db = getDb();
  const [row] = await db
    .select({ product })
    .from(product)
    .innerJoin(auction, eq(auction.id, product.auctionId))
    .where(and(eq(product.id, productId), eq(product.auctionId, auctionId)));
  if (!row) return null;
  const images = await db.select().from(productImage).where(eq(productImage.productId, productId)).orderBy(asc(productImage.position), asc(productImage.createdAt));
  return { product: row.product, images };
}

export type AdminBidRow = { id: string; amountCents: number; createdAt: Date; bidderName: string; bidderEmail: string; leading: boolean };

/** Every bid on a product, highest first, with the real bidder (admin only). */
export async function getProductBids(productId: string): Promise<AdminBidRow[]> {
  await requireAdmin();
  const db = getDb();
  const [[lot], rows] = await Promise.all([
    db.select({ leadingBidId: product.leadingBidId }).from(product).where(eq(product.id, productId)),
    db
      .select({ id: bid.id, amountCents: bid.amountCents, createdAt: bid.createdAt, bidderName: user.name, bidderEmail: user.email })
      .from(bid)
      .innerJoin(user, eq(user.id, bid.userId))
      .where(eq(bid.productId, productId))
      .orderBy(desc(bid.amountCents))
      .limit(500),
  ]);
  return rows.map((r) => ({ ...r, leading: r.id === lot?.leadingBidId }));
}
