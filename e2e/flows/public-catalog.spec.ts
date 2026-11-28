/**
 * Public catalog pages, against the production DB (opt-in, `npm run test:e2e:flow`).
 * Uses a seeded [TEST] *draft*: drafts are never public, so the admin's preview stands in for
 * a published auction, and anonymous visitors must not see it at all.
 */
import { expect, test, type Page } from "@playwright/test";
import { eq, like } from "drizzle-orm";
import { adminPage, deleteAuditRows, deleteTrackedSessions, flowsEnabled, seedDraftAuction, signOut, testRunId, withDb } from "./helpers";

test.skip(!flowsEnabled || !process.env.UPLOAD_DIR, "opt-in: ALLOW_DB_TESTS=1, EMAIL_DRY_RUN_FILE and UPLOAD_DIR");
test.describe.configure({ mode: "serial" });

const runId = testRunId();
const title = `[TEST] ${runId} Catálogo`;
const slug = `test-${runId}-catalogo`;
let auctionId: string;

test.beforeAll(async () => {
  auctionId = await seedDraftAuction({
    title,
    slug,
    startsAt: new Date("2030-12-21T01:00:00.000Z"), // 20 Dec 2030, 19:00 in Mexico City
    endsAt: new Date("2030-12-21T03:30:00.000Z"),
    lots: [
      { lot: 1, title: "[TEST] Reloj", startingPriceCents: 150000, minIncrementCents: 10000, photos: 2 },
      { lot: 2, title: "[TEST] Jarrón", startingPriceCents: 80000, minIncrementCents: 5000, photos: 1 },
    ],
  });
});

test.afterAll(async () => {
  const { auction } = await import("../../lib/db/schema");
  // Photo files live in the runner's temp UPLOAD_DIR, which it deletes afterwards. Other specs
  // share it while they run, so don't delete files here.
  if (auctionId) await withDb((db) => db.delete(auction).where(eq(auction.id, auctionId)));
  await withDb((db) => db.delete(auction).where(like(auction.title, `[TEST] ${runId}%`)));
  await deleteAuditRows(runId);
  await deleteTrackedSessions();
});

/** Seconds left on the countdown ("Empieza en 1,460 d 05:03:02"). */
async function countdownSeconds(page: Page): Promise<number> {
  const text = (await page.getByTestId("countdown").first().textContent()) ?? "";
  const m = text.match(/(?:([\d,]+) d )?(\d{2}):(\d{2}):(\d{2})/);
  if (!m) throw new Error(`No countdown in "${text}"`);
  return Number((m[1] ?? "0").replaceAll(",", "")) * 86400 + Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]);
}

test("visitors never see a draft; the admin previews it with correct times and countdown", async ({ browser }) => {
  // 1. Anonymous visitors: no draft anywhere, not even its title in the page metadata
  const visitor = await (await browser.newContext({ timezoneId: "Asia/Tokyo", locale: "es-MX" })).newPage();
  await visitor.goto(`/subastas/${slug}`);
  await expect(visitor.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  expect(await visitor.title()).not.toContain(title);
  await visitor.goto(`/subastas/${slug}/1`);
  await expect(visitor.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  for (const path of ["/", "/subastas", "/subastas?estado=finalizadas"]) {
    await visitor.goto(path);
    await expect(visitor.getByText(title)).toHaveCount(0);
  }
  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1, name: "Subastas en línea de vehículos, maquinaria y equipo" })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Registrarme", exact: true })).toBeVisible();

  // 2. The admin, browsing from Tokyo, sees the preview in Mexico City time plus Tokyo time
  const admin = await adminPage(browser, "Asia/Tokyo");
  await admin.goto(`/subastas/${slug}`);
  await expect(admin.getByText("Vista previa")).toBeVisible();
  await expect(admin.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(admin.getByTestId("auction-clock")).toHaveAttribute("data-phase", "draft");
  await expect(admin.getByTestId("countdown")).toContainText("Empieza en");
  const times = admin.getByTestId("auction-times");
  await expect(times).toContainText("viernes, 20 de diciembre de 2030, 19:00 GMT-6");
  await expect(times).toContainText("En tu hora local (Asia/Tokyo): sábado, 21 de diciembre de 2030, 10:00 GMT+9");
  await expect(admin.getByRole("link", { name: /Lote 1.*\[TEST\] Reloj.*Precio de salida \$1,500\.00/ })).toBeVisible();
  await expect(admin.getByRole("heading", { name: "Lotes (2)" })).toBeVisible();

  // 3. The lot page: photos, prices, neighbours
  await admin.getByRole("link", { name: /Lote 1/ }).click();
  await admin.waitForURL((url) => url.pathname === `/subastas/${slug}/1`);
  await expect(admin.getByRole("heading", { level: 1, name: "[TEST] Reloj" })).toBeVisible();
  await expect(admin.getByTestId("lot-prices")).toContainText("$1,500.00");
  await expect(admin.getByTestId("lot-prices")).toContainText("$100.00");
  await expect(admin.getByRole("button", { name: /Ver foto 2 de 2/ })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Siguiente: Lote 2" })).toBeVisible();
  await expect(admin.getByText("Estás viendo la página como administrador.")).toBeVisible();
  await expect(admin).toHaveTitle(/Subastas del sur/); // drafts don't put their title in metadata

  // 4. The countdown follows the server's clock: a device clock 3 days fast shows the same time left
  await admin.goto(`/subastas/${slug}`);
  await expect.poll(() => countdownSeconds(admin)).toBeGreaterThan(0);
  const honest = await countdownSeconds(admin);
  const skewedContext = await browser.newContext({ timezoneId: "Asia/Tokyo", locale: "es-MX", storageState: await admin.context().storageState() });
  await skewedContext.clock.install({ time: new Date(Date.now() + 3 * 86_400_000) });
  const skewed = await skewedContext.newPage();
  await skewed.goto(`/subastas/${slug}`);
  await skewed.clock.resume();
  expect(await skewed.evaluate(() => Date.now())).toBeGreaterThan(Date.now() + 2 * 86_400_000); // the device clock really is wrong
  await expect.poll(async () => Math.abs((await countdownSeconds(skewed)) - honest), { timeout: 10_000 }).toBeLessThan(120);
  await skewedContext.close();

  // 5. An admin edit shows up on the public page right away (catalog cache tags)
  await admin.goto(`/admin/subastas/${auctionId}`);
  await admin.getByLabel("Título").fill(`${title} editado`);
  await admin.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
  const newSlug = (await admin.getByRole("link", { name: /^\/subastas\// }).textContent())!.replace("/subastas/", "").trim();
  await admin.goto(`/subastas/${newSlug}`);
  await expect(admin.getByRole("heading", { level: 1, name: `${title} editado` })).toBeVisible();

  await admin.goto("/admin");
  await signOut(admin);
});
