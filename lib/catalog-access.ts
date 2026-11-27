import "server-only";
import { type CatalogAuction, getAuctionBySlug } from "./catalog";
import { getCurrentUser } from "./dal";

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

/** For generateMetadata: never reveal a draft's title. */
export async function getPublicAuctionTitle(slug: string): Promise<string | null> {
  const auction = await getAuctionBySlug(slug);
  return auction && auction.status !== "draft" ? auction.title : null;
}
