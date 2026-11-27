import type { Browser, Page } from "@playwright/test";

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

/** A signed-in admin page in a browser emulating `timezoneId`. Call `signOut` at the end. */
export async function adminPage(browser: Browser, timezoneId: string): Promise<Page> {
  const context = await browser.newContext({ timezoneId, locale: "es-MX" });
  const page = await context.newPage();
  await page.goto("/entrar?next=/admin");
  await page.getByLabel("Correo electrónico").fill(process.env.ADMIN_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Match the pathname: the sign-in URL itself (/entrar?next=/admin) also ends in "/admin".
  await page.waitForURL((url) => url.pathname === "/admin");
  await trackSession(page);
  return page;
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
