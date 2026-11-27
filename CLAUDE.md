# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Implementation plan

The full build plan covers scope, stack, data model, timezone rules, bidding rules, routes, phases and open decisions:

@docs/PLAN.md

Follow it, and keep its "Progress" checklist and "Open decisions" up to date as work lands. The timezone rules are the app's core requirement. Every auction instant is stored in UTC, admin input is interpreted in the auction's timezone on the server, and bid validity uses only the database clock.

**The only database is the production MariaDB on the VPS. Development uses it too.** Before running any migration, seed, test or SQL against it, follow "Working against the production database" in the plan: back up first, migrations only, no destructive SQL without the owner's go-ahead. Connection and SSH details are in `.env.local` (gitignored). Never copy them into tracked files.

## Project state

Phase 0 (foundations) is done. See "Progress" in the plan for what exists. The UI is still only a heading on `app/page.tsx`. The site is in Spanish (`lang="es"`).

## Commands

```bash
npm run dev          # dev server on http://localhost:3000 (TZ=UTC; also re-writes the AGENTS.md block)
npm run build        # production build (TZ=UTC); also the main type/prerender check
npm run start        # serve the production build (what pm2 runs on the VPS)
npm run lint         # ESLint 9 flat config (next core-web-vitals + typescript)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests, run 3 times: TZ=UTC, Asia/Tokyo, America/Los_Angeles
npx vitest run lib/time.test.ts -t "DST"   # one file / one test by name
npm run test:e2e     # Playwright (e2e/), in Mexico City and Tokyo browser timezones; reuses a running dev server

npm run db:tunnel    # SSH tunnel to the VPS MariaDB (local 127.0.0.1:3307); keep open for any db:* / test:db
npm run db:check     # read-only: version, session timezone (must be +00:00), tables
npm run db:generate  # drizzle-kit generate from lib/db/schema.ts into drizzle/; review the SQL
npm run db:migrate   # backs up on the VPS (scripts/db-backup.sh), then drizzle-kit migrate
npm run db:backup    # backup only: /root/backups/subastasdelsur/*.sql.gz, newest 20 kept
npm run test:db      # opt-in DB tests (ALLOW_DB_TESTS=1); writes only inside rolled-back transactions
```

## Code layout

- `lib/time.ts`: every wall-clock to instant conversion and every auction-time display. Never format or parse auction times anywhere else.
- `lib/db/schema.ts`: the Drizzle schema and its conventions (UTC `DATETIME(3)`, `*_cents` BIGINT, `varchar(36)` UUIDs).
- `lib/db/index.ts` (with `server-only`): what app code imports.
- `lib/db/client.ts`: the pool and `getDb()`, without the `server-only` guard, so scripts and DB tests can use it.
- `scripts/`: run with `tsx`. Without `"type": "module"` there's no top-level `await`, so wrap scripts in `main()`. They load env with `@next/env`'s `loadEnvConfig`. Vitest runs with `NODE_ENV=test`, which skips `.env.local`, so DB tests call `process.loadEnvFile`.
- npm blocks dependency install scripts (esbuild, fsevents) until they're approved. Everything works without them, so don't approve them unasked.

## Stack and non-default configuration

- **Next.js 16.4 (App Router only) + React 19.3 + TypeScript (strict)**. This Next.js is newer than most training data. Check the version-matched docs in `node_modules/next/dist/docs/` (`01-app/` for App Router, `03-api-reference` for config and APIs) before you use an API.
- **`next.config.ts` turns on flags that change how data fetching and navigation work:**
  - `cacheComponents: true`: Cache Components mode. Dynamic data must sit behind `<Suspense>` or be cached with `"use cache"`. The old route-segment caching options (`dynamic`, `revalidate`, etc.) don't apply in the usual way. See `01-app/01-getting-started/08-caching.md` and `02-guides/migrating-to-cache-components.md`.
  - `partialPrefetching: true`: `<Link>` prefetches only a route's static/cached App Shell. To prefetch URL-specific cached content, use `<Link prefetch={true}>`. See `02-guides/adopting-partial-prefetching.md`.
  - `experimental.agentFeedback: true`: this is why `next dev` keeps re-inserting the block in `AGENTS.md`. Commit that file as-is and don't strip the block.
- **Tailwind CSS v4 is loaded through the Turbopack loader** (`@tailwindcss/turbopack` in `next.config.ts` `turbopack.rules`), not PostCSS, and there's no `tailwind.config`. Theme tokens are set in CSS with `@theme inline` in `app/globals.css`. Light and dark mode come from CSS variables plus `prefers-color-scheme`.
- Fonts: Geist and Geist Mono via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono`.
- Route props use Next's generated global types (e.g. `LayoutProps<"/">` in `app/layout.tsx`; `PageProps<"/route">` works the same way). The types come from `.next/types` and `.next/dev/types`, so run `dev` or `build` once if they're missing.
- Path alias: `@/*` maps to the repo root.
