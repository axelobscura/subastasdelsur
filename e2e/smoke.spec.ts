import { expect, test } from "@playwright/test";

test("home page renders in Spanish", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Subastas del sur");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Subastas del sur");
});
