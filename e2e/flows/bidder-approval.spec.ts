/**
 * Full bidder registration → email confirmation → admin approval flow, against the real
 * (production) database. Opt-in. Needs a server started with EMAIL_DRY_RUN=1 and
 * EMAIL_DRY_RUN_FILE, so no real email is sent and the test can read the links:
 *
 *   npm run test:e2e:flow     (see package.json)
 *
 * Creates one "[TEST]" bidder with an example.com address and deletes it afterwards.
 */
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { deleteTrackedSessions, trackSession } from "./helpers";

const emailFile = process.env.EMAIL_DRY_RUN_FILE;
test.skip(process.env.ALLOW_DB_TESTS !== "1" || !emailFile, "opt-in: ALLOW_DB_TESTS=1 and EMAIL_DRY_RUN_FILE");
test.describe.configure({ mode: "serial" });

type Sent = { to: string; subject: string; text: string };

async function emailsTo(address: string): Promise<Sent[]> {
  const raw = await readFile(emailFile!, "utf8").catch(() => "");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Sent)
    .filter((e) => e.to === address);
}

async function waitForEmail(address: string, subject: RegExp): Promise<Sent> {
  let found: Sent | undefined;
  await expect
    .poll(async () => {
      found = (await emailsTo(address)).find((e) => subject.test(e.subject));
      return Boolean(found);
    }, { timeout: 15_000 })
    .toBe(true);
  return found!;
}

const bidderEmail = `test-${Date.now()}@example.com`;
const bidderPassword = "clave-de-prueba-123";
const adminEmail = process.env.ADMIN_EMAIL!;
const adminNotify = process.env.ADMIN_NOTIFICATION_EMAIL!;

test.afterAll(async () => {
  const { createDb, createPool } = await import("../../lib/db/client");
  const { user } = await import("../../lib/db/schema");
  const pool = createPool();
  await createDb(pool).delete(user).where(eq(user.email, bidderEmail)); // cascades sessions/accounts
  await pool.end();
  await deleteTrackedSessions();
});

test("a bidder registers, confirms the email, and the admin approves them", async ({ browser }) => {
  // 1. Register
  const bidder = await (await browser.newContext()).newPage();
  await bidder.goto("/registro");
  await bidder.getByLabel("Nombre completo").fill("[TEST] Postor de prueba");
  await bidder.getByLabel("Correo electrónico").fill(bidderEmail);
  await bidder.getByLabel("Teléfono").fill("55 1234 5678");
  await bidder.getByLabel("Contraseña", { exact: true }).fill(bidderPassword);
  await bidder.getByLabel("Confirma tu contraseña").fill(bidderPassword);
  await bidder.getByLabel(/Acepto los términos/).check();
  await bidder.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(bidder.getByRole("status").filter({ hasText: `Te enviamos un correo a ${bidderEmail}` })).toBeVisible();

  // 2. Unverified bidders can't sign in (and get the link again)
  await bidder.goto("/entrar");
  await bidder.getByLabel("Correo electrónico").fill(bidderEmail);
  await bidder.getByLabel("Contraseña").fill(bidderPassword);
  await bidder.getByRole("button", { name: "Iniciar sesión" }).click();
  // (filter by text: Next.js also renders a hidden role="alert" route announcer)
  await expect(bidder.getByRole("alert").filter({ hasText: "Primero confirma tu correo" })).toBeVisible();

  // 3. Confirm the email with the link from the verification email
  const verify = await waitForEmail(bidderEmail, /Confirma tu correo/);
  expect(verify.text).toContain("nuestro equipo validará tu acceso");
  const link = verify.text.match(/https?:\/\/\S+verify-email\S+/)?.[0];
  expect(link).toBeTruthy();
  await bidder.goto(link!);
  await expect(bidder).toHaveURL(/\/cuenta-confirmada/);
  await expect(bidder.getByText("¡Tu correo está confirmado!")).toBeVisible();

  // 4. "Access is being validated" email to the bidder, details email to the admin
  const received = await waitForEmail(bidderEmail, /Tu acceso está en validación/);
  expect(received.text).toContain("validando tu acceso");
  const adminMail = await waitForEmail(adminNotify, /Nuevo postor por aprobar/);
  expect(adminMail.text).toContain(bidderEmail);
  expect(adminMail.text).toContain("55 1234 5678");
  expect(adminMail.text).toContain("[TEST] Postor de prueba");
  expect(adminMail.text).toMatch(/GMT-6/); // registration time in Mexico City time

  // 5. The bidder is signed in, but pending
  await bidder.goto("/mi-cuenta");
  await expect(bidder.getByText("Tu cuenta está en revisión")).toBeVisible();

  // 6. Non-admins can't see the admin area
  // (the check runs inside <Suspense>, after streaming starts, so the status stays 200; what
  // matters is that only the 404 page renders, with no admin nav or data)
  await bidder.goto("/admin/postores");
  await expect(bidder.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await expect(bidder.getByText("Subastas del sur · Admin")).toHaveCount(0);
  await expect(bidder.getByText(bidderEmail)).toHaveCount(0);

  // 7. The admin approves the bidder
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/admin/postores");
  await expect(admin).toHaveURL(/\/entrar\?next=/);
  await admin.getByLabel("Correo electrónico").fill(adminEmail);
  await admin.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD!);
  await admin.getByRole("button", { name: "Iniciar sesión" }).click();
  await admin.waitForURL((url) => url.pathname === "/admin/postores");
  await trackSession(admin);
  await admin.getByRole("link", { name: "[TEST] Postor de prueba" }).click();
  await expect(admin.getByText("Confirmó su correo y espera tu revisión.")).toBeVisible();
  await admin.getByRole("button", { name: "Aprobar" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Aprobaste a" })).toBeVisible();
  await expect(admin.getByText("Aprobado", { exact: true })).toBeVisible();

  // 8. Approval email, and the bidder's account shows approved
  await waitForEmail(bidderEmail, /Tu cuenta fue aprobada/);
  await bidder.goto("/mi-cuenta");
  await expect(bidder.getByText("Cuenta aprobada")).toBeVisible();

  // Don't leave an admin session behind in the production database
  await admin.getByRole("button", { name: "Cerrar sesión" }).click();
  await admin.waitForURL((url) => url.pathname === "/");
});
