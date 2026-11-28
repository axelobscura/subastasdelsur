/**
 * Phase 7 checks against a production build and the production DB (opt-in, `npm run test:e2e:flow`):
 * accessibility (axe, WCAG 2.1 AA) on public and admin pages, phone layout, security headers,
 * sharing metadata, sitemap/robots, health, and the admin audit log.
 * Uses an unlisted live [TEST] auction (never listed) and a [TEST] draft; all deleted afterwards.
 */
import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { adminPage, deleteAuditRows, deleteTrackedSessions, flowsEnabled, seedBidder, seedDraftAuction, seedLiveUnlistedAuction, signOut, signedInPage, testRunId, withDb } from "./helpers";

test.skip(!flowsEnabled || !process.env.UPLOAD_DIR, "opt-in: ALLOW_DB_TESTS=1, EMAIL_DRY_RUN_FILE and UPLOAD_DIR");
test.describe.configure({ mode: "serial" });

const runId = testRunId();
let live: Awaited<ReturnType<typeof seedLiveUnlistedAuction>>;
let draftId: string;
const draftSlug = `test-${runId}-borrador`;
let bidder: { id: string; email: string; password: string };

test.beforeAll(async () => {
  live = await seedLiveUnlistedAuction({ runId, startingPriceCents: 150_000, minIncrementCents: 10_000 });
  draftId = await seedDraftAuction({
    title: `[TEST] ${runId} Borrador`,
    slug: draftSlug,
    startsAt: new Date("2030-12-21T01:00:00.000Z"),
    endsAt: new Date("2030-12-21T03:30:00.000Z"),
    lots: [{ lot: 1, title: "[TEST] Lote borrador", startingPriceCents: 100_000, minIncrementCents: 5_000, photos: 1 }],
  });
  bidder = await seedBidder("Accesible", "approved");
});

test.afterAll(async () => {
  const { auction, user } = await import("../../lib/db/schema");
  await withDb(async (db) => {
    await db.delete(auction).where(inArray(auction.id, [live?.auctionId, draftId].filter(Boolean) as string[]));
    if (bidder) await db.delete(user).where(eq(user.id, bidder.id));
  });
  await deleteAuditRows(runId);
  await deleteTrackedSessions();
});

/** Serious and critical WCAG 2.1 A/AA problems on the page, as readable strings. */
async function a11yViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test("public pages are accessible and fit a phone", async ({ browser }) => {
  const desktop = await (await browser.newContext({ locale: "es-MX" })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], locale: "es-MX" })).newPage();
  const pages = ["/", "/subastas", "/entrar", "/registro", "/recuperar", `/subastas/${live.slug}`, `/subastas/${live.slug}/1`, "/no-existe"];
  for (const path of pages) {
    await desktop.goto(path);
    await desktop.waitForLoadState("networkidle");
    expect(await a11yViolations(desktop), `axe on ${path}`).toEqual([]);
    await phone.goto(path);
    await phone.waitForLoadState("networkidle");
    expect(await noHorizontalScroll(phone), `no sideways scroll on a phone at ${path}`).toBe(true);
  }

  // The live lot with a signed-in approved bidder (bid form showing)
  const signed = await signedInPage(browser, "America/Mexico_City", bidder.email, bidder.password, `/subastas/${live.slug}/1`);
  await expect(signed.getByLabel(/Tu puja/)).toBeVisible();
  expect(await a11yViolations(signed), "axe on the bid form").toEqual([]);
});

test("admin pages are accessible, and admin changes are audited", async ({ browser }) => {
  const admin = await adminPage(browser, "America/Mexico_City");

  // Make a change, then find it in the audit log
  await admin.goto(`/admin/subastas/${draftId}`);
  await admin.getByLabel("Título").fill(`[TEST] ${runId} Borrador editado`);
  await admin.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
  const history = admin.getByTestId("audit-list");
  await expect(history).toContainText(`Editó la subasta · [TEST] ${runId} Borrador editado`);
  await expect(history).toContainText(`título: [TEST] ${runId} Borrador → [TEST] ${runId} Borrador editado`);
  await admin.goto("/admin/actividad");
  await expect(admin.getByTestId("audit-list")).toContainText(`[TEST] ${runId} Borrador editado`);

  const lots = (await withDb(async (db) => {
    const { product } = await import("../../lib/db/schema");
    return db.select({ id: product.id }).from(product).where(eq(product.auctionId, draftId));
  })) as { id: string }[];
  for (const path of [
    "/admin",
    "/admin/subastas",
    `/admin/subastas/${draftId}`,
    `/admin/subastas/${draftId}/productos/${lots[0].id}`,
    `/admin/subastas/${draftId}/productos/nuevo`,
    `/admin/subastas/${live.auctionId}/resultados`,
    "/admin/subastas/nueva",
    "/admin/postores",
    "/admin/actividad",
  ]) {
    await admin.goto(path);
    await admin.waitForLoadState("networkidle");
    expect(await a11yViolations(admin), `axe on ${path}`).toEqual([]);
  }
  await admin.goto("/admin");
  await signOut(admin);
});

test("security headers, sharing metadata, sitemap, robots and health", async ({ request, browser }) => {
  const home = await request.get("/");
  expect(home.headers()["x-frame-options"]).toBe("DENY");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

  const page = await (await browser.newContext()).newPage();
  await page.goto(`/subastas/${live.slug}/1`);
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toBeTruthy();
  const ogImage = await request.get(new URL(og!).pathname);
  expect(ogImage.status()).toBe(200);
  expect(ogImage.headers()["content-type"]).toBe("image/jpeg");
  expect(await page.locator('meta[name="description"]').getAttribute("content")).toContain("Precio de salida $1,500.00");

  // A draft's preview image doesn't exist, and its title isn't in the page
  await page.goto(`/subastas/${draftSlug}`);
  const draftOg = await page.locator('meta[property="og:image"]').getAttribute("content");
  if (draftOg) expect((await request.get(new URL(draftOg).pathname)).status()).toBe(404);
  expect(await page.content()).not.toContain(`[TEST] ${runId}`);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).not.toContain(live.slug); // unlisted
  expect(sitemap).not.toContain(draftSlug); // draft
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Sitemap:");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, db: "ok" });
});
