import { defineConfig, devices } from "@playwright/test";

// Each test runs in browsers emulating different timezones. The app must look and behave
// the same for every visitor (see "Timezone rules" in docs/PLAN.md).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    locale: "es-MX",
  },
  projects: [
    { name: "mexico-city", use: { ...devices["Desktop Chrome"], timezoneId: "America/Mexico_City" } },
    { name: "tokyo", use: { ...devices["Desktop Chrome"], timezoneId: "Asia/Tokyo" } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
