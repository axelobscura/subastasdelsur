/**
 * Bidding rules (pure, unit-tested). Implements "Bidding rules" in docs/PLAN.md. `now` is
 * always the database clock inside the bid transaction (`dbNow(tx)`).
 */
import type { AuctionStatus } from "./db/schema";
import { MAX_CENTS } from "./money";
import { auctionPhase } from "./time";

export type BidError = "unauthenticated" | "not_bidder" | "not_approved" | "not_live" | "too_low" | "too_high" | "already_leading" | "invalid_amount" | "rate_limited" | "not_found";

export const BID_ERROR_MESSAGES: Record<BidError, string> = {
  unauthenticated: "Inicia sesión para pujar.",
  not_bidder: "Las cuentas de administración no pueden pujar.",
  not_approved: "Tu cuenta todavía no está aprobada para pujar.",
  not_live: "Esta subasta no está abierta para pujas en este momento.",
  too_low: "Tu puja es menor que la puja mínima. Alguien pudo haber pujado antes que tú: revisa el precio actual.",
  too_high: "Esa cantidad es demasiado alta. Revisa la cifra.",
  already_leading: "Ya tienes la puja más alta en este lote.",
  invalid_amount: "Escribe una cantidad válida, por ejemplo 1500 o 1,500.50.",
  rate_limited: "Estás pujando demasiado rápido. Espera unos segundos.",
  not_found: "No encontramos este lote.",
};

export type LotPricing = {
  startingPriceCents: number;
  minIncrementCents: number;
  currentPriceCents: number | null;
  bidCount: number;
};

/** The lowest acceptable next bid: the starting price first, then current price + increment. */
export function minimumBid(lot: LotPricing): number {
  return lot.bidCount === 0 || lot.currentPriceCents === null ? lot.startingPriceCents : lot.currentPriceCents + lot.minIncrementCents;
}

/** Bids far above the minimum are almost always typos ($150,000 for $1,500). */
export function maximumBid(lot: LotPricing): number {
  return Math.min(MAX_CENTS, Math.max(minimumBid(lot) * 10, minimumBid(lot) + 100 * lot.minIncrementCents));
}

export type BidCheck = {
  auction: { status: AuctionStatus; startsAt: Date; endsAt: Date };
  lot: LotPricing;
  amountCents: number;
  bidderId: string;
  leadingBidderId: string | null;
  now: Date;
};

/** Why a bid can't be accepted, or null if it can. */
export function bidProblem({ auction, lot, amountCents, bidderId, leadingBidderId, now }: BidCheck): BidError | null {
  if (auction.status !== "published" || auctionPhase(auction.startsAt, auction.endsAt, now) !== "live") return "not_live";
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return "invalid_amount";
  if (leadingBidderId === bidderId) return "already_leading";
  if (amountCents < minimumBid(lot)) return "too_low";
  if (amountCents > maximumBid(lot)) return "too_high";
  return null;
}

/**
 * Stable anonymous names for a lot's bidders ("Postor 1", "Postor 2"…), numbered by their
 * first bid. Visitors never see who bids, only that different people are bidding.
 */
export function bidderLabels(bidsOldestFirst: { userId: string }[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const { userId } of bidsOldestFirst) if (!labels.has(userId)) labels.set(userId, `Postor ${labels.size + 1}`);
  return labels;
}

export type MyLotStatus = "leading" | "outbid" | "won" | "lost" | "reserve_not_met" | "cancelled";

/** A bidder's standing on a lot they bid on, for "Mis pujas". */
export function myLotStatus(opts: {
  auction: { status: AuctionStatus; startsAt: Date; endsAt: Date };
  isLeading: boolean;
  currentPriceCents: number | null;
  reservePriceCents: number | null;
  now: Date;
}): MyLotStatus {
  if (opts.auction.status === "cancelled") return "cancelled";
  const ended = auctionPhase(opts.auction.startsAt, opts.auction.endsAt, opts.now) === "ended";
  if (!ended) return opts.isLeading ? "leading" : "outbid";
  if (!opts.isLeading) return "lost";
  const reserveMet = opts.reservePriceCents === null || (opts.currentPriceCents ?? 0) >= opts.reservePriceCents;
  return reserveMet ? "won" : "reserve_not_met";
}

export const MY_LOT_STATUS_LABELS: Record<MyLotStatus, string> = {
  leading: "Vas ganando",
  outbid: "Te superaron",
  won: "Ganaste",
  lost: "No ganaste",
  reserve_not_met: "No se alcanzó el precio de reserva",
  cancelled: "Subasta cancelada",
};
