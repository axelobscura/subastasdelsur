import { getAuctionBySlug } from "@/lib/catalog";
import { OG_SIZE, coverAsOgJpeg, ogNotFound } from "@/lib/og-image";

export const size = OG_SIZE;
export const contentType = "image/jpeg";
export const alt = "Foto de la subasta";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const auction = await getAuctionBySlug((await params).slug);
  if (!auction || auction.status === "draft") return ogNotFound();
  return coverAsOgJpeg(auction.cover?.key);
}
