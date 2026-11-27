/**
 * Admin auction window flow against the production database (opt-in, `npm run test:e2e:flow`).
 * The core requirement: the start is the same instant wherever the admin works from.
 * Creates "[TEST]" draft auctions (never published, so never public) and deletes them afterwards.
 */
import { expect, test } from "@playwright/test";
import { eq, like, sql } from "drizzle-orm";
import { adminPage, createDraft, deleteTrackedSessions, flowsEnabled, signOut, testRunId, withDb } from "./helpers";

test.skip(!flowsEnabled, "opt-in: ALLOW_DB_TESTS=1 and EMAIL_DRY_RUN_FILE");
test.describe.configure({ mode: "serial" });

const runId = testRunId();
const titlePrefix = `[TEST] ${runId}`;

test.afterAll(async () => {
  const { auction } = await import("../../lib/db/schema");
  await withDb((db) => db.delete(auction).where(like(auction.title, `${titlePrefix}%`)));
  await deleteTrackedSessions();
});

async function storedWindow(id: string) {
  const { auction } = await import("../../lib/db/schema");
  return withDb(async (db) => {
    const [row] = await db
      .select({
        startsAt: auction.startsAt,
        rawStart: sql<string>`DATE_FORMAT(${auction.startsAt}, '%Y-%m-%d %H:%i:%s')`,
        status: auction.status,
      })
      .from(auction)
      .where(eq(auction.id, id));
    return row;
  });
}


test("an admin in Tokyo and an admin in Los Angeles set the same Mexico City start time", async ({ browser }) => {
  // 1. An admin whose computer is in Tokyo creates an auction for 20 Dec 2030, 19:00 Mexico City time
  const tokyo = await adminPage(browser, "Asia/Tokyo");
  await tokyo.goto("/admin/subastas/nueva");
  await tokyo.getByLabel("Inicio", { exact: true }).fill("2030-12-20T19:00");
  // The preview shows the auction's time and the admin's own local time
  const preview = tokyo.getByTestId("preview-Inicio");
  await expect(preview).toContainText("20 de diciembre de 2030, 19:00 GMT-6");
  await expect(preview).toContainText("En tu hora local (Asia/Tokyo): sábado, 21 de diciembre de 2030, 10:00 GMT+9");

  const id = await createDraft(tokyo, `${titlePrefix} Zona horaria`, "2030-12-20T19:00", "2030-12-20T21:30");
  const summary = tokyo.getByTestId("auction-summary");
  await expect(summary).toContainText("viernes, 20 de diciembre de 2030, 19:00 GMT-6");
  await expect(summary).toContainText("2030-12-21T01:00:00.000Z → 2030-12-21T03:30:00.000Z");
  // Stored as the UTC instant, not the Tokyo wall clock
  expect((await storedWindow(id)).rawStart).toBe("2030-12-21 01:00:00");

  // 2. Publishing is blocked until the auction has products with photos
  await expect(tokyo.getByText("Agrega al menos un producto.")).toBeVisible();
  await expect(tokyo.getByRole("button", { name: "Publicar subasta" })).toBeDisabled();

  // 3. An admin in Los Angeles sees the same Mexico City wall clock in the form, and moves it to 18:00
  const la = await adminPage(browser, "America/Los_Angeles");
  await la.goto(`/admin/subastas/${id}`);
  await expect(la.getByLabel("Inicio", { exact: true })).toHaveValue("2030-12-20T19:00");
  await la.getByLabel("Inicio", { exact: true }).fill("2030-12-20T18:00");
  await la.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(la.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
  await expect(la.getByTestId("auction-summary")).toContainText("2030-12-21T00:00:00.000Z");
  expect((await storedWindow(id)).startsAt.toISOString()).toBe("2030-12-21T00:00:00.000Z");

  // 4. Validation: a start in the past, or an end before the start, is refused
  await la.getByLabel("Inicio", { exact: true }).fill("2020-01-01T10:00");
  await la.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(la.getByText("El inicio debe ser en el futuro.")).toBeVisible();
  await la.goto(`/admin/subastas/${id}`);
  await la.getByLabel("Cierre", { exact: true }).fill("2030-12-20T18:02");
  await la.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(la.getByText("El cierre debe ser al menos 5 minutos después del inicio.")).toBeVisible();
  expect((await storedWindow(id)).startsAt.toISOString()).toBe("2030-12-21T00:00:00.000Z");

  // 5. The new auction is listed with its time in Mexico City time
  await tokyo.goto("/admin/subastas");
  const row = tokyo.getByRole("row").filter({ hasText: `${titlePrefix} Zona horaria` });
  await expect(row).toContainText("Borrador");
  await expect(row).toContainText("20 dic 2030, 18:00 GMT-6");

  // 6. Cancelling needs the confirmation box, then the auction becomes read-only
  await tokyo.goto(`/admin/subastas/${id}`);
  await tokyo.getByRole("button", { name: "Cancelar subasta" }).click();
  await expect(tokyo.getByText("Marca la casilla para confirmar la cancelación.")).toBeVisible();
  await tokyo.getByLabel(/Confirmo que quiero cancelar/).check();
  await tokyo.getByRole("button", { name: "Cancelar subasta" }).click();
  await expect(tokyo.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(tokyo.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
  expect((await storedWindow(id)).status).toBe("cancelled");

  // 7. A draft can be deleted (with confirmation)
  const draftId = await createDraft(la, `${titlePrefix} Para borrar`, "2030-11-01T10:00", "2030-11-01T12:00");
  await la.getByLabel(/Confirmo que quiero eliminar/).check();
  await la.getByRole("button", { name: "Eliminar borrador" }).click();
  await expect(la).toHaveURL(/\/admin\/subastas\?eliminada=1$/);
  await expect(la.getByText("Borrador eliminado.")).toBeVisible();
  expect(await storedWindow(draftId)).toBeUndefined();

  await signOut(tokyo);
  await signOut(la);
});
