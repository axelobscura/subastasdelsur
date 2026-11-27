import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same env loading as Next.js: .env.local locally, real env vars on the VPS.
loadEnvConfig(process.cwd());

// The only database is production. Use `npm run db:migrate` (it backs up first),
// never `drizzle-kit push`. See "Working against the production database" in docs/PLAN.md.
export default defineConfig({
  dialect: "mysql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
