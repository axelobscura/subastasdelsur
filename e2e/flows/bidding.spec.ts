/**
 * Live bidding against the production DB (opt-in, `npm run test:e2e:flow`), on a published but
 * *unlisted* [TEST] auction (never in the public lists). Two approved bidders in different
 * timezones bid against each other; everything is deleted afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { eq, inArray, sql } from "drizzle-orm";
import { adminPage, deleteTrackedSessions, flowsEnabled, seedBidder, seedLiveUnlistedAuction, signOut, signedInPage, testRunId, withDb } from "./helpers";

test.skip(!flowsEnabled || !process.env.UPLOAD_DIR, "opt-in: ALLOW_DB_TESTS=1, EMAIL_DRY_RUN_FILE and UPLOAD_DIR");
test.describe.configure({ mode: "serial" });

const runId = testRunId();
let seeded: Awaited<ReturnType<typeof seedLiveUnlistedAuction>>;
const people: Record<"ana" | "beto" | "carla", { id: string; email: string; password: string }> = {} as never;

test.beforeAll(async () => {
  seeded = await seedLiveUnlistedAuction({ runId, startingPriceCents: 150_000, minIncrementCents: 10_000 });
  people.ana = await seedBidder("Ana", "approved");
  people.beto = await seedBidder("Beto", "approved");
  people.carla = await seedBidder("Carla", "pending");
});

test.afterAll(async () => {
  const { auction, user } = await import("../../lib/db/schema");
  await withDb(async (db) => {
    if (seeded) await db.delete(auction).where(eq(auction.id, seeded.auctionId)); // cascades lots and bids
    const ids = Object.values(people).map((p) => p.id);
    if (ids.length) await db.delete(user).where(inArray(user.id, ids)); // cascades sessions and accounts
  });
  await deleteTrackedSessions();
});

const lotUrl = () => `/subastas/${seeded.slug}/1`;
const price = (page: Page) => page.getByTestId("current-price");

async function bid(page: Page, amount: string) {
  await page.getByLabel(/Tu puja/).fill(amount);
  await page.getByRole("button", { name: /^(Pujar|Confirmar)/ }).click();
}

test("two bidders in different timezones bid against each other, live", async ({ browser }) => {
  // Visitors: the unlisted auction is not listed, but its lot page works by link (read-only)
  const visitor = await (await browser.newContext({ locale: "es-MX" })).newPage();
  await visitor.goto("/subastas?estado=en-vivo");
  await expect(visitor.getByText(`[TEST] ${runId}`)).toHaveCount(0);
  await visitor.goto(lotUrl());
  await expect(price(visitor)).toHaveText("$1,500.00");
  await expect(visitor.getByTestId("bid-count")).toHaveText("Sin pujas");
  await expect(visitor.getByText("¿Quieres pujar?")).toBeVisible();
  await expect(visitor.getByLabel(/Tu puja/)).toHaveCount(0);

  // A pending bidder sees the review notice and no bid form
  const carla = await signedInPage(browser, "America/Mexico_City", people.carla.email, people.carla.password, lotUrl());
  await expect(carla.getByText("Tu cuenta está en revisión")).toBeVisible();
  await expect(carla.getByLabel(/Tu puja/)).toHaveCount(0);

  // Ana (Mexico City) opens the first bid at the starting price
  const ana = await signedInPage(browser, "America/Mexico_City", people.ana.email, people.ana.password, lotUrl());
  const beto = await signedInPage(browser, "Asia/Tokyo", people.beto.email, people.beto.password, lotUrl());
  await expect(ana.getByTestId("auction-clock")).toHaveAttribute("data-phase", "live");
  await expect(ana.getByLabel(/Tu puja/)).toHaveValue("1500");
  await bid(ana, "1500");
  await expect(ana.getByTestId("bid-feedback")).toHaveText("¡Listo! Tu puja de $1,500.00 es la más alta.");
  await expect(ana.getByText("Vas ganando")).toBeVisible();
  await expect(ana.getByTestId("bid-history")).toContainText("Postor 1 (tú)");

  // Beto (Tokyo) sees it arrive by polling, with the minimum moved up, and outbids her
  await expect(price(beto)).toHaveText("$1,500.00", { timeout: 10_000 });
  await expect(beto.getByTestId("minimum-bid")).toHaveText("$1,600.00");
  await expect(beto.getByLabel(/Tu puja/)).toHaveValue("1600");
  await bid(beto, "1600");
  await expect(beto.getByText("Vas ganando")).toBeVisible();

  // Ana is told she was outbid; a stale bid at the old minimum is refused by the server
  await expect(ana.getByText("Te superaron")).toBeVisible({ timeout: 10_000 });
  await bid(ana, "1600");
  await expect(ana.getByTestId("bid-feedback")).toContainText("Tu puja es menor que la puja mínima");
  await expect(price(ana)).toHaveText("$1,600.00");

  // A big jump (3× the minimum or more) needs a second click
  await ana.getByLabel(/Tu puja/).fill("6000");
  await ana.getByRole("button", { name: "Pujar" }).click();
  await expect(ana.getByRole("button", { name: "Confirmar $6,000.00" })).toBeVisible();
  await ana.getByRole("button", { name: "Confirmar $6,000.00" }).click();
  await expect(ana.getByText("Vas ganando")).toBeVisible();
  await expect(ana.getByTestId("bid-count")).toHaveText("3 pujas");
  await expect(beto.getByText("Te superaron")).toBeVisible({ timeout: 10_000 });
  // Bidders are anonymous to each other
  await expect(beto.getByTestId("bid-history")).toContainText("Postor 1");
  await expect(beto.getByTestId("bid-history")).not.toContainText("Ana");

  // The admin sees who bid, with real names
  const admin = await adminPage(browser, "America/Mexico_City");
  await admin.goto(`/admin/subastas/${seeded.auctionId}/productos/${seeded.productId}`);
  const table = admin.getByTestId("admin-bids");
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table).toContainText("[TEST] Ana");
  await expect(table).toContainText("[TEST] Beto");
  await expect(table.getByRole("row").nth(1)).toContainText("$6,000.00");

  // Close the auction (end = DB now): both pages notice, the form goes away
  const { auction } = await import("../../lib/db/schema");
  await withDb((db) => db.update(auction).set({ endsAt: sql`UTC_TIMESTAMP(3)` }).where(eq(auction.id, seeded.auctionId)));
  await expect(ana.getByText("Tu puja fue la más alta")).toBeVisible({ timeout: 10_000 });
  await expect(ana.getByLabel(/Tu puja/)).toHaveCount(0);
  await expect(beto.getByText("La subasta terminó: ya no se reciben pujas.")).toBeVisible({ timeout: 10_000 });
  await expect(beto.getByTestId("auction-clock")).toHaveAttribute("data-phase", "ended");

  // "Mis pujas"
  await ana.goto("/mi-cuenta");
  await expect(ana.getByTestId("my-bids")).toContainText("Tu puja más alta $6,000.00");
  await expect(ana.getByTestId("my-bids")).toContainText("Ganaste");
  await beto.goto("/mi-cuenta");
  await expect(beto.getByTestId("my-bids")).toContainText("No ganaste");

  await admin.goto("/admin");
  await signOut(admin);
});
