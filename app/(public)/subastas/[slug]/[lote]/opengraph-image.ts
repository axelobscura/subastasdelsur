import { getAuctionBySlug, getCatalogProduct } from "@/lib/catalog";
import { OG_SIZE, coverAsOgJpeg, ogNotFound } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "Foto del lote";

export default async function Image({ params }: { params: Promise<{ slug: string; lote: string }> }) {
  const { slug, lote } = await params;
  const auction = await getAuctionBySlug(slug);
  if (!auction || auction.status === "draft" || !/^\d{1,4}$/.test(lote)) return ogNotFound();
  const item = await getCatalogProduct(auction.id, Number(lote));
  if (!item) return ogNotFound();
  return coverAsOgJpeg(item.images[0]?.key ?? auction.cover?.key);
}
