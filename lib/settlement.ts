/**
 * What happens when an auction ends (pure, unit-tested). Implements phase 6 of docs/PLAN.md:
 * each lot is sold (to its leading bid, if the reserve is met), unsold (reserve not met) or had
 * no bids. Every bidder gets one result email per auction; the admin gets a summary.
 */

export type Person = { userId: string; name: string; email: string; phone?: string };

export type SettlementLot = {
  productId: string;
  lotNumber: number;
  title: string;
  bidCount: number;
  currentPriceCents: number | null;
  reservePriceCents: number | null;
  leader: Person | null;
  /** Everyone who bid on the lot, the leader included. */
  bidders: Person[];
};

export type LotOutcome = "sold" | "reserve_not_met" | "no_bids";

export const LOT_OUTCOME_LABELS: Record<LotOutcome, string> = {
  sold: "Vendido",
  reserve_not_met: "Reserva no alcanzada",
  no_bids: "Sin pujas",
};

export function lotOutcome(lot: Pick<SettlementLot, "bidCount" | "currentPriceCents" | "reservePriceCents" | "leader">): LotOutcome {
  if (lot.bidCount === 0 || lot.currentPriceCents === null || !lot.leader) return "no_bids";
  if (lot.reservePriceCents !== null && lot.currentPriceCents < lot.reservePriceCents) return "reserve_not_met";
  return "sold";
}

export type BidderResult = Person & {
  won: SettlementLot[];
  /** They had the top bid, but it didn't reach the reserve. */
  reserveNotMet: SettlementLot[];
  /** Someone else won (or it went unsold to someone else's top bid). */
  notWon: SettlementLot[];
};

export type SettlementPlan = {
  outcomes: Map<string, LotOutcome>;
  bidders: BidderResult[];
  summary: { lots: number; sold: number; reserveNotMet: number; noBids: number; totalSoldCents: number };
};

export function planSettlement(lots: SettlementLot[]): SettlementPlan {
  const outcomes = new Map<string, LotOutcome>();
  const bidders = new Map<string, BidderResult>();
  const summary = { lots: lots.length, sold: 0, reserveNotMet: 0, noBids: 0, totalSoldCents: 0 };
  const sorted = [...lots].sort((a, b) => a.lotNumber - b.lotNumber);

  for (const lot of sorted) {
    const outcome = lotOutcome(lot);
    outcomes.set(lot.productId, outcome);
    if (outcome === "sold") {
      summary.sold++;
      summary.totalSoldCents += lot.currentPriceCents!;
    } else if (outcome === "reserve_not_met") summary.reserveNotMet++;
    else summary.noBids++;

    for (const person of lot.bidders) {
      const entry = bidders.get(person.userId) ?? { ...person, won: [], reserveNotMet: [], notWon: [] };
      const isLeader = lot.leader?.userId === person.userId;
      if (isLeader && outcome === "sold") entry.won.push(lot);
      else if (isLeader && outcome === "reserve_not_met") entry.reserveNotMet.push(lot);
      else entry.notWon.push(lot);
      bidders.set(person.userId, entry);
    }
  }
  return { outcomes, bidders: [...bidders.values()], summary };
}

export const OUTBID_EMAIL_INTERVAL_MS = 10 * 60 * 1000;

/** At most one "te superaron" email per bidder and lot every 10 minutes (bidding wars). */
export function shouldSendOutbidEmail(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= OUTBID_EMAIL_INTERVAL_MS;
}
