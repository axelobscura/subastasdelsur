// Bidding against the real database. Opt-in (`npm run test:db`, tunnel up).
// - Rules: inside a transaction that is rolled back (nothing persists).
// - Concurrency: real commits on separate connections, on an *unlisted* [TEST] auction that is
//   never shown on the site; everything it creates is deleted at the end.
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getLotState, placeBidCore } from "../bids-db";
import { createDb, createPool } from "./client";
import { auction, bid, product, user } from "./schema";

class Rollback extends Error {}

describe.runIf(process.env.ALLOW_DB_TESTS === "1")("bidding on the real database", { timeout: 30_000 }, () => {
  let pool: ReturnType<typeof createPool>;
  let db: ReturnType<typeof createDb>;

  beforeAll(() => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    pool = createPool();
    db = createDb(pool);
  });
  afterAll(async () => {
    await pool?.end();
  });

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  async function seedLiveLot(executor: typeof db | Tx, opts: { bidders: number; startOffsetMs?: number; endOffsetMs?: number }) {
    const run = crypto.randomUUID().slice(0, 8);
    const userIds = Array.from({ length: opts.bidders }, () => crypto.randomUUID());
    for (const [i, id] of userIds.entries()) {
      await executor.insert(user).values({ id, name: `[TEST] Postor ${i + 1}`, email: `test-bid-${run}-${i}@example.com`, phone: "5512345678", emailVerified: true, approvalStatus: "approved" });
    }
    const auctionId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    // Window relative to the DB clock (UTC_TIMESTAMP), so the test never depends on this machine's clock.
    await executor.execute(sql`
      INSERT INTO auction (id, slug, title, description, status, listed, starts_at, ends_at, timezone, created_at, updated_at)
      VALUES (${auctionId}, ${`test-bid-${run}`}, ${`[TEST] bids ${run}`}, '', 'published', false,
              UTC_TIMESTAMP(3) + INTERVAL ${opts.startOffsetMs ?? -60_000} * 1000 MICROSECOND,
              UTC_TIMESTAMP(3) + INTERVAL ${opts.endOffsetMs ?? 600_000} * 1000 MICROSECOND,
              'America/Mexico_City', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`);
    await executor.insert(product).values({ id: productId, auctionId, lotNumber: 1, title: "[TEST] Lote", description: "", startingPriceCents: 150000, minIncrementCents: 10000 });
    return { auctionId, productId, userIds };
  }

  it("applies the rules with the DB clock and keeps the lot's price and leader in step (rolled back)", async () => {
    await expect(
      db.transaction(async (tx) => {
        const { productId, userIds: [ana, beto] } = await seedLiveLot(tx, { bidders: 2 });

        expect(await placeBidCore(tx, { productId, userId: ana, amountCents: 149_999 })).toEqual({ ok: false, error: "too_low" });
        expect(await placeBidCore(tx, { productId, userId: ana, amountCents: 150_000 })).toMatchObject({ ok: true });
        expect(await placeBidCore(tx, { productId, userId: ana, amountCents: 200_000 })).toEqual({ ok: false, error: "already_leading" });
        expect(await placeBidCore(tx, { productId, userId: beto, amountCents: 159_999 })).toEqual({ ok: false, error: "too_low" });
        expect(await placeBidCore(tx, { productId, userId: beto, amountCents: 160_000 })).toMatchObject({ ok: true });

        const forAna = await getLotState(tx, productId, ana);
        expect(forAna).toMatchObject({ phase: "live", currentPriceCents: 160_000, bidCount: 2, minimumNextCents: 170_000, reserve: "none", you: { isLeading: false, hasBid: true } });
        expect(forAna!.history.map((h) => [h.label, h.amountCents, h.isYou])).toEqual([
          ["Postor 2", 160_000, false],
          ["Postor 1", 150_000, true],
        ]);
        expect((await getLotState(tx, productId, beto))!.you).toEqual({ isLeading: true, hasBid: true });
        expect((await getLotState(tx, productId, null))!.you).toBeNull();

        // Bid timestamps come from the DB clock
        const [{ skewMs }] = (await tx.execute(sql`SELECT TIMESTAMPDIFF(MICROSECOND, MAX(created_at), UTC_TIMESTAMP(3)) / 1000 AS skewMs FROM bid WHERE product_id = ${productId}`))[0] as unknown as { skewMs: string }[];
        expect(Math.abs(Number(skewMs))).toBeLessThan(5_000);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("refuses bids before the start and from the end instant on (rolled back)", async () => {
    await expect(
      db.transaction(async (tx) => {
        const upcoming = await seedLiveLot(tx, { bidders: 1, startOffsetMs: 60_000, endOffsetMs: 120_000 });
        expect(await placeBidCore(tx, { productId: upcoming.productId, userId: upcoming.userIds[0], amountCents: 150_000 })).toEqual({ ok: false, error: "not_live" });
        const ended = await seedLiveLot(tx, { bidders: 1, startOffsetMs: -120_000, endOffsetMs: 0 });
        expect(await placeBidCore(tx, { productId: ended.productId, userId: ended.userIds[0], amountCents: 150_000 })).toEqual({ ok: false, error: "not_live" });
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("accepts exactly one of five simultaneous bids for the same amount (real commits, cleaned up)", async () => {
    const { auctionId, productId, userIds } = await seedLiveLot(db, { bidders: 5 });
    try {
      const results = await Promise.all(userIds.map((userId) => placeBidCore(db, { productId, userId, amountCents: 150_000 })));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(Array(4).fill("too_low"));
      const [lot] = await db.select({ price: product.currentPriceCents, count: product.bidCount }).from(product).where(eq(product.id, productId));
      expect(lot).toEqual({ price: 150_000, count: 1 });
      expect(await db.select({ id: bid.id }).from(bid).where(eq(bid.productId, productId))).toHaveLength(1);
    } finally {
      await db.delete(auction).where(eq(auction.id, auctionId)); // cascades product and bids
      await db.delete(user).where(inArray(user.id, userIds));
    }
  });
});
