// Settlement and notifications on the real database (opt-in: `npm run test:db`, tunnel up).
// Real commits on an *unlisted* [TEST] auction, cleaned up at the end. Emails are dry-run into a
// temp file. Never calls settleDueAuctions: that would touch real auctions.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placeBidCore } from "../bids-db";
import { auctionBidders, notifyOutbid, settleAuction } from "../settlement-db";
import { createDb, createPool } from "./client";
import { auction, notification, product, user } from "./schema";

describe.runIf(process.env.ALLOW_DB_TESTS === "1")("settlement on the real database", { timeout: 60_000 }, () => {
  let pool: ReturnType<typeof createPool>;
  let db: ReturnType<typeof createDb>;
  let dir: string;
  const run = crypto.randomUUID().slice(0, 8);
  const auctionId = crypto.randomUUID();
  const lots = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const people = { ana: crypto.randomUUID(), beto: crypto.randomUUID(), carla: crypto.randomUUID() };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    dir = await mkdtemp(path.join(tmpdir(), "subastas-settle-"));
    process.env.EMAIL_DRY_RUN = "1";
    process.env.EMAIL_DRY_RUN_FILE = path.join(dir, "emails.jsonl");
    process.env.ADMIN_NOTIFICATION_EMAIL = "admin-test@example.com"; // never the real inbox from tests
    pool = createPool();
    db = createDb(pool);
    for (const [name, id] of Object.entries(people)) {
      await db.insert(user).values({ id, name: `[TEST] ${name}`, email: `test-settle-${run}-${name}@example.com`, phone: "5512345678", emailVerified: true, approvalStatus: "approved" });
    }
    await db.execute(sql`
      INSERT INTO auction (id, slug, title, description, status, listed, starts_at, ends_at, timezone, created_at, updated_at)
      VALUES (${auctionId}, ${`test-settle-${run}`}, ${`[TEST] settle ${run}`}, '', 'published', false,
              UTC_TIMESTAMP(3) - INTERVAL 10 MINUTE, UTC_TIMESTAMP(3) + INTERVAL 10 MINUTE, 'America/Mexico_City', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`);
    const lot = { auctionId, description: "", startingPriceCents: 150_000, minIncrementCents: 10_000 };
    await db.insert(product).values([
      { id: lots[0], lotNumber: 1, title: "[TEST] Reloj", ...lot },
      { id: lots[1], lotNumber: 2, title: "[TEST] Jarrón", reservePriceCents: 500_000, ...lot },
      { id: lots[2], lotNumber: 3, title: "[TEST] Sin pujas", ...lot },
    ]);
  });

  afterAll(async () => {
    await db?.delete(auction).where(eq(auction.id, auctionId)); // cascades lots, bids, notifications
    await db?.delete(user).where(inArray(user.id, Object.values(people)));
    await pool?.end();
    await rm(dir, { recursive: true, force: true });
  });

  const emails = async () =>
    (await readFile(process.env.EMAIL_DRY_RUN_FILE!, "utf8").catch(() => ""))
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { to: string; subject: string; text: string });

  it("emails an outbid bidder once, then throttles", async () => {
    expect(await placeBidCore(db, { productId: lots[0], userId: people.ana, amountCents: 150_000 })).toMatchObject({ ok: true, previousLeaderId: null });
    const outbid = await placeBidCore(db, { productId: lots[0], userId: people.beto, amountCents: 160_000 });
    expect(outbid).toMatchObject({ ok: true, previousLeaderId: people.ana });
    expect(await placeBidCore(db, { productId: lots[1], userId: people.carla, amountCents: 150_000 })).toMatchObject({ ok: true });

    expect(await notifyOutbid(db, { productId: lots[0], previousLeaderId: people.ana })).toBe(true);
    expect(await notifyOutbid(db, { productId: lots[0], previousLeaderId: people.ana })).toBe(false); // within 10 minutes
    const sent = (await emails()).filter((e) => e.subject.startsWith("Te superaron"));
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(`test-settle-${run}-ana@example.com`);
    expect(sent[0].text).toContain("La puja actual es de $1,600.00");
    expect((await auctionBidders(db, auctionId)).map((b) => b.name).sort()).toEqual(["[TEST] ana", "[TEST] beto", "[TEST] carla"]);
  });

  it("doesn't settle before the end, nor within the worker's grace period", async () => {
    expect(await settleAuction(db, auctionId)).toEqual({ settled: false });
    await db.update(auction).set({ endsAt: sql`UTC_TIMESTAMP(3)` }).where(eq(auction.id, auctionId));
    expect(await settleAuction(db, auctionId, { graceMs: 60_000 })).toEqual({ settled: false });
  });

  it("settles exactly once even when three callers race, and emails each bidder their result", async () => {
    const results = await Promise.all([settleAuction(db, auctionId), settleAuction(db, auctionId), settleAuction(db, auctionId)]);
    const winners = results.filter((r) => r.settled);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ settled: true, failed: 0, summary: { lots: 3, sold: 1, reserveNotMet: 1, noBids: 1, totalSoldCents: 160_000 } });
    expect(await settleAuction(db, auctionId)).toEqual({ settled: false });

    const byTo = Object.fromEntries((await emails()).filter((e) => !e.subject.startsWith("Te superaron")).map((e) => [e.to, e]));
    expect(Object.keys(byTo).sort()).toEqual(["admin-test@example.com", ...["ana", "beto", "carla"].map((n) => `test-settle-${run}-${n}@example.com`)].sort());
    expect(byTo[`test-settle-${run}-beto@example.com`].subject).toBe("¡Ganaste en la subasta! · Subastas del sur");
    expect(byTo[`test-settle-${run}-beto@example.com`].text).toContain("Lote 1: [TEST] Reloj · $1,600.00");
    expect(byTo[`test-settle-${run}-ana@example.com`].text).toContain("otra persona hizo la puja más alta");
    expect(byTo[`test-settle-${run}-carla@example.com`].text).toContain("no se alcanzó el precio de reserva");
    expect(byTo["admin-test@example.com"].text).toContain("Vendidos: 1 de 3");

    const logged = await db.select({ kind: notification.kind }).from(notification).where(and(eq(notification.auctionId, auctionId)));
    expect(logged.map((n) => n.kind).sort()).toEqual(["admin_summary", "auction_result", "auction_result", "auction_result", "outbid"]);
  });
});
