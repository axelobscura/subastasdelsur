/**
 * Products and photos on a draft auction, against the production database (opt-in,
 * `npm run test:e2e:flow`). Photos go to the runner's temporary UPLOAD_DIR, never the real one.
 * The auction is never published; it's deleted at the end along with its files.
 */
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { like } from "drizzle-orm";
import sharp from "sharp";
import { adminPage, createDraft, deleteTrackedSessions, flowsEnabled, signOut, testRunId, withDb } from "./helpers";

test.skip(!flowsEnabled || !process.env.UPLOAD_DIR, "opt-in: ALLOW_DB_TESTS=1, EMAIL_DRY_RUN_FILE and UPLOAD_DIR");
test.describe.configure({ mode: "serial" });

const titlePrefix = `[TEST] ${testRunId()}`;
let fixtures: string;

test.beforeAll(async () => {
  fixtures = await mkdtemp(path.join(tmpdir(), "subastas-fixtures-"));
  const base = (color: string) => sharp({ create: { width: 1600, height: 1200, channels: 3, background: color } });
  await writeFile(path.join(fixtures, "reloj-frente.jpg"), await base("#8a6d3b").jpeg().withExif({ IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N" } }).toBuffer());
  await writeFile(path.join(fixtures, "reloj-detalle.png"), await base("#334455").png().toBuffer());
  await writeFile(path.join(fixtures, "no-es-foto.jpg"), "esto no es una imagen");
});

test.afterAll(async () => {
  const { auction } = await import("../../lib/db/schema");
  await withDb((db) => db.delete(auction).where(like(auction.title, `${titlePrefix}%`)));
  await deleteTrackedSessions();
  await rm(fixtures, { recursive: true, force: true });
});

/** Product folders this test created (other specs share UPLOAD_DIR while they run). */
const ownProducts = new Set<string>();

/** Photo files of this test's products. */
async function storedFiles(): Promise<string[]> {
  const root = path.join(process.env.UPLOAD_DIR!, "products");
  const out: string[] = [];
  for (const dir of ownProducts) {
    for (const file of await readdir(path.join(root, dir)).catch(() => [] as string[])) out.push(`${dir}/${file}`);
  }
  return out;
}

/** The /media/... paths of the photo grid, in display order. */
async function gridMediaPaths(page: Page): Promise<string[]> {
  const srcs = await page.getByTestId("photo-grid").locator("img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src") ?? ""));
  return srcs.map((src) => decodeURIComponent(new URL(src, "http://x").searchParams.get("url") ?? src));
}

test("an admin adds products with prices and photos, and the publish checks follow", async ({ browser }) => {
  const admin = await adminPage(browser, "America/Mexico_City");
  const auctionId = await createDraft(admin, `${titlePrefix} Productos`, "2030-10-10T18:00", "2030-10-10T20:00");

  // 1. Publishing needs products
  await expect(admin.getByText("Agrega al menos un producto.")).toBeVisible();

  // 2. Add a product; a reserve below the starting price is refused
  await admin.getByRole("link", { name: "Agregar producto" }).click();
  await expect(admin.getByLabel("Número de lote")).toHaveValue("1");
  await admin.getByLabel("Nombre del producto").fill("[TEST] Reloj de bolsillo");
  await admin.getByLabel("Descripción").fill("Reloj de prueba.");
  await admin.getByLabel("Precio de salida").fill("1,500");
  await admin.getByLabel("Incremento mínimo por puja").fill("100");
  await admin.getByLabel("Precio de reserva (opcional)").fill("1000");
  await admin.getByRole("button", { name: "Crear producto" }).click();
  await expect(admin.getByText("El precio de reserva no puede ser menor que el precio de salida.")).toBeVisible();
  await admin.getByLabel("Precio de reserva (opcional)").fill("2,000");
  await admin.getByRole("button", { name: "Crear producto" }).click();
  await admin.waitForURL((url) => /\/productos\/[0-9a-f-]{36}$/.test(url.pathname) && url.searchParams.get("creado") === "1");
  ownProducts.add(admin.url().match(/productos\/([0-9a-f-]{36})/)![1]);
  await expect(admin.getByText("Este producto todavía no tiene fotos.")).toBeVisible();

  // 3. Upload two photos and one fake: the fake is refused, the others are re-encoded to WebP
  await admin.getByLabel("Agregar fotos").setInputFiles(["reloj-frente.jpg", "reloj-detalle.png", "no-es-foto.jpg"].map((f) => path.join(fixtures, f)));
  const results = admin.getByTestId("upload-results");
  await expect(results).toContainText("reloj-frente.jpg: subida.");
  await expect(results).toContainText("reloj-detalle.png: subida.");
  await expect(results).toContainText("no-es-foto.jpg: Formato no compatible.");
  await expect(admin.getByRole("heading", { name: "Fotos (2/12)" })).toBeVisible();
  expect(await storedFiles()).toHaveLength(2);

  // 4. Photos are served from /media as cacheable WebP; anything else under /media is a 404
  const [first, second] = await gridMediaPaths(admin);
  expect(first).toMatch(/^\/media\/products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
  const media = await admin.request.get(first);
  expect(media.status()).toBe(200);
  expect(media.headers()["content-type"]).toBe("image/webp");
  expect(media.headers()["cache-control"]).toContain("immutable");
  expect((await sharp(await media.body()).metadata()).exif).toBeUndefined(); // GPS/EXIF stripped
  for (const bad of ["/media/..%2F..%2F.env.local", "/media/products/x/y.webp", "/media/products/../../package.json"]) {
    expect((await admin.request.get(bad)).status(), bad).toBe(404);
  }

  // 5. Make the second photo the cover, then delete the other one
  await admin.getByTestId("photo-grid").getByRole("listitem").nth(1).getByRole("button", { name: "Portada" }).click();
  await expect.poll(() => gridMediaPaths(admin)).toEqual([second, first]);
  await admin.getByTestId("photo-grid").getByRole("listitem").nth(1).getByRole("button", { name: "Eliminar" }).click();
  await expect(admin.getByRole("heading", { name: "Fotos (1/12)" })).toBeVisible();
  await expect.poll(storedFiles).toHaveLength(1);

  // 6. The auction lists the product with prices; now it could be published (the test never does)
  await admin.goto(`/admin/subastas/${auctionId}`);
  const row = admin.getByRole("link", { name: /Lote 1: \[TEST\] Reloj de bolsillo/ });
  await expect(row).toContainText("Salida $1,500.00 · incremento $100.00 · reserva $2,000.00");
  await expect(row).toContainText("1 foto");
  await expect(admin.getByText("Lista para publicar.")).toBeVisible();
  await expect(admin.getByRole("button", { name: "Publicar subasta" })).toBeEnabled();

  // 7. A second product: lot numbers must be unique, and a product without photos blocks publishing
  await admin.getByRole("link", { name: "Agregar producto" }).click();
  await expect(admin.getByLabel("Número de lote")).toHaveValue("2");
  await admin.getByLabel("Número de lote").fill("1");
  await admin.getByLabel("Nombre del producto").fill("[TEST] Jarrón");
  await admin.getByLabel("Precio de salida").fill("800");
  await admin.getByLabel("Incremento mínimo por puja").fill("50");
  await admin.getByRole("button", { name: "Crear producto" }).click();
  await expect(admin.getByText("Ya hay un producto con ese número de lote en esta subasta.")).toBeVisible();
  await admin.getByLabel("Número de lote").fill("2");
  await admin.getByRole("button", { name: "Crear producto" }).click();
  await admin.waitForURL((url) => url.searchParams.get("creado") === "1");
  ownProducts.add(admin.url().match(/productos\/([0-9a-f-]{36})/)![1]);
  await admin.goto(`/admin/subastas/${auctionId}`);
  await expect(admin.getByText("Un producto no tiene fotos.")).toBeVisible();
  await expect(admin.getByRole("button", { name: "Publicar subasta" })).toBeDisabled();

  // 8. Delete the second product, then the whole draft: its photo files go too
  await admin.getByRole("link", { name: /Lote 2: \[TEST\] Jarrón/ }).click();
  await admin.getByLabel(/Confirmo que quiero eliminar este producto/).check();
  await admin.getByRole("button", { name: "Eliminar producto" }).click();
  await expect(admin.getByText("Producto eliminado.")).toBeVisible();
  await expect(admin.getByText("Lista para publicar.")).toBeVisible();
  await admin.goto(`/admin/subastas/${auctionId}`);
  await admin.getByLabel(/Confirmo que quiero eliminar este borrador/).check();
  await admin.getByRole("button", { name: "Eliminar borrador" }).click();
  await expect(admin.getByText("Borrador eliminado.")).toBeVisible();
  await expect.poll(storedFiles).toHaveLength(0);

  await signOut(admin);
});
