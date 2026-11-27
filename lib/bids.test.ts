import { describe, expect, it } from "vitest";
import { bidProblem, bidderLabels, maximumBid, minimumBid, myLotStatus } from "./bids";

const live = { status: "published" as const, startsAt: new Date("2026-12-06T01:00:00.000Z"), endsAt: new Date("2026-12-06T03:00:00.000Z") };
const during = new Date("2026-12-06T02:00:00.000Z");
const fresh = { startingPriceCents: 150000, minIncrementCents: 10000, currentPriceCents: null, bidCount: 0 };
const bidding = { ...fresh, currentPriceCents: 170000, bidCount: 3 };
const check = (over: Partial<Parameters<typeof bidProblem>[0]>) =>
  bidProblem({ auction: live, lot: fresh, amountCents: 150000, bidderId: "ana", leadingBidderId: null, now: during, ...over });

describe("minimumBid", () => {
  it("is the starting price for the first bid, then current price + increment", () => {
    expect(minimumBid(fresh)).toBe(150000);
    expect(minimumBid(bidding)).toBe(180000);
  });
});

describe("bidProblem", () => {
  it("accepts the minimum and anything above it (within reason)", () => {
    expect(check({})).toBeNull();
    expect(check({ lot: bidding, amountCents: 180000, leadingBidderId: "beto" })).toBeNull();
    expect(check({ lot: bidding, amountCents: 250000, leadingBidderId: "beto" })).toBeNull();
  });

  it("rejects bids below the minimum", () => {
    expect(check({ amountCents: 149999 })).toBe("too_low");
    expect(check({ lot: bidding, amountCents: 179999, leadingBidderId: "beto" })).toBe("too_low");
  });

  it("rejects the bidder who is already leading", () => {
    expect(check({ lot: bidding, amountCents: 180000, leadingBidderId: "ana" })).toBe("already_leading");
  });

  it("only accepts bids while the auction is live, by the given (DB) clock", () => {
    expect(check({ now: new Date("2026-12-06T00:59:59.999Z") })).toBe("not_live");
    expect(check({ now: new Date("2026-12-06T01:00:00.000Z") })).toBeNull(); // the start instant is live
    expect(check({ now: new Date("2026-12-06T02:59:59.999Z") })).toBeNull();
    expect(check({ now: new Date("2026-12-06T03:00:00.000Z") })).toBe("not_live"); // the end instant is closed
    expect(check({ auction: { ...live, status: "draft" } })).toBe("not_live");
    expect(check({ auction: { ...live, status: "cancelled" } })).toBe("not_live");
  });

  it("rejects typo-sized bids and nonsense amounts", () => {
    expect(maximumBid(fresh)).toBe(1_500_000); // 10× the minimum here (more than minimum + 100 increments)
    expect(check({ amountCents: maximumBid(fresh) })).toBeNull();
    expect(check({ amountCents: maximumBid(fresh) + 1 })).toBe("too_high");
    expect(check({ amountCents: 0 })).toBe("invalid_amount");
    expect(check({ amountCents: 1.5 })).toBe("invalid_amount");
  });
});

describe("bidderLabels", () => {
  it("numbers bidders by their first bid", () => {
    const labels = bidderLabels([{ userId: "b" }, { userId: "a" }, { userId: "b" }, { userId: "c" }]);
    expect([...labels.entries()]).toEqual([
      ["b", "Postor 1"],
      ["a", "Postor 2"],
      ["c", "Postor 3"],
    ]);
  });
});

describe("myLotStatus", () => {
  const ended = new Date("2026-12-06T03:00:00.000Z");
  const base = { auction: live, currentPriceCents: 200000, reservePriceCents: null };
  it("tracks leading/outbid while live, and won/lost/reserve after the end", () => {
    expect(myLotStatus({ ...base, isLeading: true, now: during })).toBe("leading");
    expect(myLotStatus({ ...base, isLeading: false, now: during })).toBe("outbid");
    expect(myLotStatus({ ...base, isLeading: true, now: ended })).toBe("won");
    expect(myLotStatus({ ...base, isLeading: false, now: ended })).toBe("lost");
    expect(myLotStatus({ ...base, isLeading: true, reservePriceCents: 250000, now: ended })).toBe("reserve_not_met");
    expect(myLotStatus({ ...base, isLeading: true, reservePriceCents: 200000, now: ended })).toBe("won");
    expect(myLotStatus({ ...base, auction: { ...live, status: "cancelled" }, isLeading: true, now: during })).toBe("cancelled");
  });
});
