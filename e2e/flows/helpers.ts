import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Unique id for one spec's [TEST] rows. Specs run in parallel and can start in the same
 * millisecond, so a timestamp alone isn't enough (teardown deletes by this prefix).
 */
export function testRunId(): string {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Opt-in guard for flows that write to the production database. */
export const flowsEnabled = process.env.ALLOW_DB_TESTS === "1" && Boolean(process.env.EMAIL_DRY_RUN_FILE);

/** Session tokens created by this test process, deleted in teardown even if a test fails. */
const createdSessionTokens: string[] = [];

/** Remember the session a page just signed in with (cookie value is "<token>.<signature>"). */
export async function trackSession(page: Page): Promise<void> {
  const cookie = (await page.context().cookies()).find((c) => c.name.endsWith("better-auth.session_token"));
  if (cookie) createdSessionTokens.push(decodeURIComponent(cookie.value).split(".")[0]);
}

/** Teardown: delete the sessions this run created (signing out normally already did). */
export async function deleteTrackedSessions(): Promise<void> {
  if (!createdSessionTokens.length) return;
  const { inArray } = await import("drizzle-orm");
  const { session } = await import("../../lib/db/schema");
  await withDb((db) => db.delete(session).where(inArray(session.token, createdSessionTokens)));
}

/** A page signed in as `email` in a browser emulating `timezoneId`, sent to `next`. */
export async function signedInPage(browser: Browser, timezoneId: string, email: string, password: string, next: string): Promise<Page> {
  const context = await browser.newContext({ timezoneId, locale: "es-MX" });
  const page = await context.newPage();
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Match the pathname: the sign-in URL itself (/entrar?next=/admin) also ends in "/admin".
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
  await trackSession(page);
  return page;
}

/** A signed-in admin page in a browser emulating `timezoneId`. Call `signOut` at the end. */
export async function adminPage(browser: Browser, timezoneId: string): Promise<Page> {
  return signedInPage(browser, timezoneId, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!, "/admin");
}

/** A [TEST] bidder with a password (via Better Auth's own hashing). Delete it in teardown. */
export async function seedBidder(name: string, approval: "approved" | "pending"): Promise<{ id: string; email: string; password: string }> {
  const { auth } = await import("../../lib/auth");
  const ctx = await auth.$context;
  const email = `test-${testRunId()}@example.com`;
  const password = `clave-${crypto.randomUUID()}`;
  const created = await ctx.internalAdapter.createUser(
    { email, name: `[TEST] ${name}`, phone: "5512345678", emailVerified: true, role: "bidder", approvalStatus: approval },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({ userId: created.id, providerId: "credential", accountId: created.id, password: await ctx.password.hash(password) });
  return { id: created.id, email, password };
}

/**
 * A published but *unlisted* [TEST] auction that is live now by the DB clock (never shown in the
 * public lists; reachable only by its random slug). One lot with a photo. Returns ids and slug.
 */
export async function seedLiveUnlistedAuction(opts: { runId: string; startingPriceCents: number; minIncrementCents: number; minutes?: number }) {
  const sharp = (await import("sharp")).default;
  const { sql } = await import("drizzle-orm");
  const { saveProductImage } = await import("../../lib/storage");
  const { product, productImage } = await import("../../lib/db/schema");
  const auctionId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const slug = `test-${opts.runId}-en-vivo`;
  await withDb(async (db) => {
    await db.execute(sql`
      INSERT INTO auction (id, slug, title, description, status, listed, starts_at, ends_at, timezone, created_at, updated_at)
      VALUES (${auctionId}, ${slug}, ${`[TEST] ${opts.runId} En vivo`}, '', 'published', false,
              UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE, UTC_TIMESTAMP(3) + INTERVAL ${opts.minutes ?? 15} MINUTE,
              'America/Mexico_City', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`);
    await db.insert(product).values({
      id: productId,
      auctionId,
      lotNumber: 1,
      position: 1,
      title: "[TEST] Reloj en vivo",
      description: "",
      startingPriceCents: opts.startingPriceCents,
      minIncrementCents: opts.minIncrementCents,
    });
    const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#996633" } }).jpeg().toBuffer();
    const stored = await saveProductImage(productId, jpeg);
    await db.insert(productImage).values({ productId, storageKey: stored.key, width: stored.width, height: stored.height, position: 0 });
  });
  return { auctionId, productId, slug };
}

/** Sign out, so no session is left in the production database. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/** Direct DB access for assertions and cleanup (the tunnel must be up). */
export async function withDb<T>(fn: (db: import("../../lib/db/client").Db) => Promise<T>): Promise<T> {
  const { createDb, createPool } = await import("../../lib/db/client");
  const pool = createPool();
  try {
    return await fn(createDb(pool));
  } finally {
    await pool.end();
  }
}

/** Create a draft auction through the admin form; returns its id. */
export async function createDraft(page: Page, title: string, startsAt: string, endsAt: string): Promise<string> {
  await page.goto("/admin/subastas/nueva");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descripción").fill("Subasta de prueba automatizada.");
  await expect(page.getByLabel("Zona horaria de la subasta")).toHaveValue("America/Mexico_City");
  await page.getByLabel("Inicio", { exact: true }).fill(startsAt);
  await page.getByLabel("Cierre", { exact: true }).fill(endsAt);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await expect(page).toHaveURL(/\/admin\/subastas\/[0-9a-f-]{36}\?creada=1$/);
  return page.url().match(/subastas\/([0-9a-f-]{36})/)![1];
}

export type SeedLot = { lot: number; title: string; startingPriceCents: number; minIncrementCents: number; photos: number };

/**
 * Insert a [TEST] draft auction with products and real photos straight into the DB and
 * UPLOAD_DIR (faster than the admin UI, which has its own tests). Drafts are never public.
 */
export async function seedDraftAuction(opts: { title: string; slug: string; startsAt: Date; endsAt: Date; lots: SeedLot[] }): Promise<string> {
  const sharp = (await import("sharp")).default;
  const { saveProductImage } = await import("../../lib/storage");
  const { auction, product, productImage } = await import("../../lib/db/schema");
  const auctionId = crypto.randomUUID();
  await withDb(async (db) => {
    await db.insert(auction).values({
      id: auctionId,
      slug: opts.slug,
      title: opts.title,
      description: "Subasta de prueba automatizada.",
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      timezone: "America/Mexico_City",
    });
    for (const lot of opts.lots) {
      const productId = crypto.randomUUID();
      await db.insert(product).values({
        id: productId,
        auctionId,
        lotNumber: lot.lot,
        position: lot.lot,
        title: lot.title,
        description: `Descripción del lote ${lot.lot}.`,
        startingPriceCents: lot.startingPriceCents,
        minIncrementCents: lot.minIncrementCents,
      });
      for (let i = 0; i < lot.photos; i++) {
        const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: i % 2 ? "#445566" : "#aa7733" } }).jpeg().toBuffer();
        const stored = await saveProductImage(productId, jpeg);
        await db.insert(productImage).values({ productId, storageKey: stored.key, width: stored.width, height: stored.height, position: i });
      }
    }
  });
  return auctionId;
}
