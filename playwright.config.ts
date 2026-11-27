import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Same env as the app (.env.local), for opt-in tests that need DB or admin credentials.
loadEnvConfig(process.cwd());

// PLAYWRIGHT_BASE_URL points at an already-running server (scripts/e2e-flow.sh). Otherwise the
// dev server is started (or reused). Each test runs in browsers emulating different timezones,
// and the app must behave the same for every visitor ("Timezone rules" in docs/PLAN.md).
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "es-MX",
  },
  projects: [
    { name: "mexico-city", use: { ...devices["Desktop Chrome"], timezoneId: "America/Mexico_City" } },
    { name: "tokyo", use: { ...devices["Desktop Chrome"], timezoneId: "Asia/Tokyo" } },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
