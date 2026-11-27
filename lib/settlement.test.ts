import { describe, expect, it } from "vitest";
import { lotOutcome, planSettlement, shouldSendOutbidEmail, type SettlementLot } from "./settlement";

const ana = { userId: "ana", name: "Ana", email: "ana@example.com" };
const beto = { userId: "beto", name: "Beto", email: "beto@example.com" };
const lot = (n: number, over: Partial<SettlementLot>): SettlementLot => ({
  productId: `p${n}`,
  lotNumber: n,
  title: `Lote ${n}`,
  bidCount: 0,
  currentPriceCents: null,
  reservePriceCents: null,
  leader: null,
  bidders: [],
  ...over,
});

describe("lotOutcome", () => {
  it("sells to the leader unless the reserve isn't met", () => {
    expect(lotOutcome(lot(1, {}))).toBe("no_bids");
    expect(lotOutcome(lot(1, { bidCount: 2, currentPriceCents: 1000, leader: ana }))).toBe("sold");
    expect(lotOutcome(lot(1, { bidCount: 2, currentPriceCents: 1000, reservePriceCents: 1000, leader: ana }))).toBe("sold");
    expect(lotOutcome(lot(1, { bidCount: 2, currentPriceCents: 999, reservePriceCents: 1000, leader: ana }))).toBe("reserve_not_met");
  });
});

describe("planSettlement", () => {
  const lots = [
    lot(2, { bidCount: 3, currentPriceCents: 50000, reservePriceCents: 80000, leader: beto, bidders: [ana, beto] }),
    lot(1, { bidCount: 2, currentPriceCents: 160000, leader: ana, bidders: [beto, ana] }),
    lot(3, {}),
    lot(4, { bidCount: 1, currentPriceCents: 20000, leader: beto, bidders: [beto] }),
  ];
  const plan = planSettlement(lots);

  it("summarises the auction", () => {
    expect(plan.summary).toEqual({ lots: 4, sold: 2, reserveNotMet: 1, noBids: 1, totalSoldCents: 180000 });
    expect(Object.fromEntries(plan.outcomes)).toEqual({ p1: "sold", p2: "reserve_not_met", p3: "no_bids", p4: "sold" });
  });

  it("gives every bidder one result with their won, reserve-not-met and not-won lots, in lot order", () => {
    const byId = Object.fromEntries(plan.bidders.map((b) => [b.userId, b]));
    expect(byId.ana.won.map((l) => l.lotNumber)).toEqual([1]);
    expect(byId.ana.notWon.map((l) => l.lotNumber)).toEqual([2]);
    expect(byId.ana.reserveNotMet).toEqual([]);
    expect(byId.beto.won.map((l) => l.lotNumber)).toEqual([4]);
    expect(byId.beto.reserveNotMet.map((l) => l.lotNumber)).toEqual([2]);
    expect(byId.beto.notWon.map((l) => l.lotNumber)).toEqual([1]);
    expect(plan.bidders).toHaveLength(2);
  });
});

describe("shouldSendOutbidEmail", () => {
  const now = new Date("2026-12-06T02:00:00.000Z");
  it("sends at most once every 10 minutes per bidder and lot", () => {
    expect(shouldSendOutbidEmail(null, now)).toBe(true);
    expect(shouldSendOutbidEmail(new Date("2026-12-06T01:50:01.000Z"), now)).toBe(false);
    expect(shouldSendOutbidEmail(new Date("2026-12-06T01:50:00.000Z"), now)).toBe(true);
  });
});
