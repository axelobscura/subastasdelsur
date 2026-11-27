/**
 * Public catalog reads, cached with `use cache` ("Caching with Cache Components" in docs/PLAN.md).
 *
 * - Only catalog data: titles, descriptions, times, prices, photos. Nothing that changes with the
 *   clock (live/ended) and nothing per user. Callers decide the phase at request time.
 * - Tags: "auctions" (any auction change) and "auction:<id>" (its products and photos). The admin
 *   Server Actions call updateTag() with these after every write.
 * - getAuctionBySlug also returns drafts and cancelled auctions. Pages must show drafts only to
 *   admins (preview) and must not leak a draft's details (title, metadata) to anyone else.
 */
import "server-only";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { type AuctionStatus, auction, getDb, product, productImage } from "./db";

export type CatalogImage = { key: string; width: number; height: number; alt: string };

export type CatalogAuction = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: AuctionStatus;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  productCount: number;
  cover: CatalogImage | null;
};

export type CatalogProduct = {
  id: string;
  lotNumber: number;
  title: string;
  description: string;
  startingPriceCents: number;
  minIncrementCents: number;
  images: CatalogImage[];
};

const auctionColumns = {
  id: auction.id,
  slug: auction.slug,
  title: auction.title,
  description: auction.description,
  status: auction.status,
  startsAt: auction.startsAt,
  endsAt: auction.endsAt,
  timezone: auction.timezone,
};

/** Product count and cover (first photo of the lowest lot) for each auction. */
async function enrich(rows: Omit<CatalogAuction, "productCount" | "cover">[]): Promise<CatalogAuction[]> {
  if (!rows.length) return [];
  const db = getDb();
  const products = await db
    .select({ id: product.id, auctionId: product.auctionId, lot: product.lotNumber })
    .from(product)
    .where(inArray(product.auctionId, rows.map((r) => r.id)))
    .orderBy(asc(product.lotNumber));
  const images = products.length
    ? await db
        .select({ productId: productImage.productId, key: productImage.storageKey, width: productImage.width, height: productImage.height, alt: productImage.alt })
        .from(productImage)
        .where(inArray(productImage.productId, products.map((p) => p.id)))
        .orderBy(asc(productImage.position), asc(productImage.createdAt))
    : [];
  const firstImage = new Map<string, CatalogImage>();
  for (const { productId, ...image } of images) if (!firstImage.has(productId)) firstImage.set(productId, image);

  return rows.map((row) => {
    const own = products.filter((p) => p.auctionId === row.id);
    const coverProduct = own.find((p) => firstImage.has(p.id));
    return { ...row, productCount: own.length, cover: coverProduct ? firstImage.get(coverProduct.id)! : null };
  });
}

/** Every published, listed auction (for the home page and /subastas). */
export async function getPublishedAuctions(): Promise<CatalogAuction[]> {
  "use cache";
  cacheTag("auctions");
  cacheLife("hours");
  // Unlisted auctions are reachable only by their link (and are how tests bid on a live auction).
  const rows = await getDb()
    .select(auctionColumns)
    .from(auction)
    .where(and(eq(auction.status, "published"), eq(auction.listed, true)))
    .orderBy(asc(auction.startsAt))
    .limit(500);
  return enrich(rows);
}

/** Any auction by slug, drafts included (see the note at the top). */
export async function getAuctionBySlug(slug: string): Promise<CatalogAuction | null> {
  "use cache";
  cacheTag("auctions");
  cacheLife("hours");
  const [row] = await getDb().select(auctionColumns).from(auction).where(eq(auction.slug, slug));
  if (!row) return null;
  cacheTag(`auction:${row.id}`);
  return (await enrich([row]))[0];
}

async function productsWithImages(where: ReturnType<typeof and>): Promise<CatalogProduct[]> {
  const db = getDb();
  const products = await db
    .select({
      id: product.id,
      lotNumber: product.lotNumber,
      title: product.title,
      description: product.description,
      startingPriceCents: product.startingPriceCents,
      minIncrementCents: product.minIncrementCents,
    })
    .from(product)
    .where(where)
    .orderBy(asc(product.lotNumber));
  if (!products.length) return [];
  const images = await db
    .select({ productId: productImage.productId, key: productImage.storageKey, width: productImage.width, height: productImage.height, alt: productImage.alt })
    .from(productImage)
    .where(inArray(productImage.productId, products.map((p) => p.id)))
    .orderBy(asc(productImage.position), asc(productImage.createdAt));
  return products.map((p) => ({
    ...p,
    images: images.filter((i) => i.productId === p.id).map((i) => ({ key: i.key, width: i.width, height: i.height, alt: i.alt })),
  }));
}

/** The products of an auction, with their photos, by lot number. */
export async function getCatalogProducts(auctionId: string): Promise<CatalogProduct[]> {
  "use cache";
  cacheTag(`auction:${auctionId}`);
  cacheLife("hours");
  return productsWithImages(and(eq(product.auctionId, auctionId)));
}

/** One product of an auction by lot number. */
export async function getCatalogProduct(auctionId: string, lotNumber: number): Promise<CatalogProduct | null> {
  "use cache";
  cacheTag(`auction:${auctionId}`);
  cacheLife("hours");
  const [found] = await productsWithImages(and(eq(product.auctionId, auctionId), eq(product.lotNumber, lotNumber)));
  return found ?? null;
}

/** Lot numbers next to `lotNumber` (for previous/next links). */
export async function getNeighbourLots(auctionId: string, lotNumber: number): Promise<{ previous: number | null; next: number | null }> {
  "use cache";
  cacheTag(`auction:${auctionId}`);
  cacheLife("hours");
  const lots = (await getDb().select({ lot: product.lotNumber }).from(product).where(and(eq(product.auctionId, auctionId), ne(product.lotNumber, lotNumber))).orderBy(asc(product.lotNumber))).map((r) => r.lot);
  return { previous: lots.filter((l) => l < lotNumber).at(-1) ?? null, next: lots.find((l) => l > lotNumber) ?? null };
}
