import "server-only";
import { type CatalogAuction, getAuctionBySlug } from "./catalog";
import { getCurrentUser } from "./dal";
import { formatAuctionTime } from "./time";

/**
 * The auction a visitor may see at /subastas/<slug>: published and cancelled ones for everyone,
 * drafts only for the admin (as a preview). Reads the session for drafts, so render inside <Suspense>.
 */
export async function getVisibleAuction(slug: string): Promise<{ auction: CatalogAuction; preview: boolean } | null> {
  const auction = await getAuctionBySlug(slug);
  if (!auction) return null;
  if (auction.status !== "draft") return { auction, preview: false };
  const user = await getCurrentUser();
  return user?.role === "admin" ? { auction, preview: true } : null;
}

/** Title and description for generateMetadata (never for drafts). */
export async function getPublicAuctionMeta(slug: string): Promise<{ title: string; description: string } | null> {
  const auction = await getAuctionBySlug(slug);
  if (!auction || auction.status === "draft") return null;
  const when = `${formatAuctionTime(auction.startsAt, auction.timezone)} a ${formatAuctionTime(auction.endsAt, auction.timezone)}`;
  const intro = auction.description.trim().replace(/\s+/g, " ").slice(0, 150);
  return {
    title: auction.title,
    description: `${intro ? `${intro} · ` : ""}Subasta en línea, ${auction.productCount} ${auction.productCount === 1 ? "lote" : "lotes"}. ${when}.`.slice(0, 300),
  };
}
