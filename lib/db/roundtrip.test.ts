// Runs against the production database, so it's opt-in: `npm run test:db` (tunnel up).
// Everything happens inside a transaction that is rolled back, so nothing is persisted.
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { wallClockToInstant } from "../time";
import { createDb, createPool } from "./client";
import { auction } from "./schema";

class Rollback extends Error {}

describe.runIf(process.env.ALLOW_DB_TESTS === "1")("database round trip (rolled back)", () => {
  let pool: ReturnType<typeof createPool>;
  let db: ReturnType<typeof createDb>;

  beforeAll(() => {
    // Vitest runs with NODE_ENV=test, where Next's env loading skips .env.local.
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
    pool = createPool();
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("pins the session to UTC", async () => {
    const [rows] = await pool.query("SELECT @@session.time_zone AS tz");
    expect((rows as { tz: string }[])[0].tz).toBe("+00:00");
  });

  it("stores the auction window as UTC and reads back the same instants, whatever the process TZ", async () => {
    const startsAt = wallClockToInstant("2026-12-05T19:00", "America/Mexico_City");
    const endsAt = wallClockToInstant("2026-12-05T21:30", "America/Mexico_City");

    await expect(
      db.transaction(async (tx) => {
        const id = crypto.randomUUID();
        await tx.insert(auction).values({
          id,
          slug: `test-${id}`,
          title: "[TEST] round trip",
          description: "",
          startsAt,
          endsAt,
          timezone: "America/Mexico_City",
        });

        const [row] = await tx.select().from(auction).where(eq(auction.id, id));
        expect(row.startsAt.toISOString()).toBe("2026-12-06T01:00:00.000Z");
        expect(row.endsAt.toISOString()).toBe("2026-12-06T03:30:00.000Z");
        expect(row.status).toBe("draft");

        // What MariaDB holds is the UTC wall-clock time.
        const [raw] = await tx.execute(
          sql`SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS s FROM auction WHERE id = ${id}`,
        );
        expect((raw as unknown as { s: string }[])[0].s).toBe("2026-12-06 01:00:00");

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    const [left] = await pool.query("SELECT COUNT(*) AS n FROM auction WHERE title = '[TEST] round trip'");
    expect(Number((left as { n: number }[])[0].n)).toBe(0);
  });

  it("counts products, photos and covers per row (correlated subqueries bind to the outer row)", async () => {
    const { auctionProductCount, auctionProductsWithoutImages, productCover, productImageCount } = await import("./aggregates");
    const { product, productImage } = await import("./schema");
    await expect(
      db.transaction(async (tx) => {
        const auctionId = crypto.randomUUID();
        const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
        const window = { startsAt: new Date("2030-01-01T18:00:00Z"), endsAt: new Date("2030-01-01T20:00:00Z") };
        await tx.insert(auction).values({ id: auctionId, slug: `test-${auctionId}`, title: "[TEST] counts", description: "", timezone: "America/Mexico_City", ...window });
        const lot = { auctionId, description: "", startingPriceCents: 1000, minIncrementCents: 100 };
        await tx.insert(product).values([
          { id: a, lotNumber: 1, title: "[TEST] A", ...lot },
          { id: b, lotNumber: 2, title: "[TEST] B", ...lot },
        ]);
        const key = (n: number) => `products/${a}/${"0".repeat(8)}-0000-4000-8000-00000000000${n}.webp`;
        await tx.insert(productImage).values([
          { productId: a, storageKey: key(2), width: 10, height: 10, position: 1 },
          { productId: a, storageKey: key(1), width: 10, height: 10, position: 0 },
        ]);

        const [counts] = await tx
          .select({ products: auctionProductCount, withoutImages: auctionProductsWithoutImages })
          .from(auction)
          .where(eq(auction.id, auctionId));
        expect(counts).toEqual({ products: 2, withoutImages: 1 });

        const rows = await tx
          .select({ id: product.id, images: productImageCount, cover: sql<string | null>`${productCover("storage_key")}` })
          .from(product)
          .where(eq(product.auctionId, auctionId))
          .orderBy(product.lotNumber);
        expect(rows).toEqual([
          { id: a, images: 2, cover: key(1) },
          { id: b, images: 0, cover: null },
        ]);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });

  it("enforces the window check (ends_at > starts_at)", async () => {
    const at = new Date("2026-12-06T01:00:00.000Z");
    const error = await db
      .transaction(async (tx) => {
        await tx.insert(auction).values({
          slug: `test-${crypto.randomUUID()}`,
          title: "[TEST] bad window",
          description: "",
          startsAt: at,
          endsAt: at,
          timezone: "America/Mexico_City",
        });
        throw new Rollback();
      })
      .catch((e: unknown) => e);
    // Drizzle wraps driver errors ("Failed query: …"); the MariaDB error is the cause.
    expect(error).not.toBeInstanceOf(Rollback);
    expect(String((error as { cause?: { message?: string } }).cause?.message)).toMatch(/auction_window_chk/);
  });
});
