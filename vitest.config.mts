import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Unit tests are pure (no DB) unless ALLOW_DB_TESTS=1; see "Working against the
// production database" in docs/PLAN.md. E2E tests live in e2e/ and run with Playwright.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.{ts,tsx}"],
  },
});
