# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Implementation plan

The full build plan covers scope, stack, data model, timezone rules, bidding rules, routes, phases and open decisions:

@docs/PLAN.md

Follow it, and keep its "Progress" checklist and "Open decisions" up to date as work lands. The timezone rules are the app's core requirement. Every auction instant is stored in UTC, admin input is interpreted in the auction's timezone on the server, and bid validity uses only the database clock.

**The only database is the production MariaDB on the VPS. Development uses it too.** Before running any migration, seed, test or SQL against it, follow "Working against the production database" in the plan: back up first, migrations only, no destructive SQL without the owner's go-ahead. Connection and SSH details are in `.env.local` (gitignored). Never copy them into tracked files.

## Project state

Phases 0–6 are done: foundations; auth, roles and admin approval of bidders; admin auctions with their time window; products and photos; the public catalog; live bidding; closing, results and notifications. See "Progress" in the plan. Hardening (phase 7) is next.

**Pushing to `main` deploys to production** (https://subastasdelsur.io) within about a minute. See "Environments" in the plan. Only push builds that pass, and apply migrations first. The site is in Spanish (`lang="es"`).

## Commands

```bash
npm run dev          # opens the DB tunnel if needed (scripts/ensure-tunnel.sh), then dev server on :3000 (TZ=UTC; also re-writes the AGENTS.md block)
npm run build        # production build (TZ=UTC); also the main type/prerender check
npm run start        # serve the production build (what pm2 runs on the VPS)
npm run lint         # ESLint 9 flat config (next core-web-vitals + typescript)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests, run 3 times: TZ=UTC, Asia/Tokyo, America/Los_Angeles
npx vitest run lib/time.test.ts -t "DST"   # one file / one test by name
npm run test:e2e     # Playwright (e2e/), in Mexico City and Tokyo browser timezones; reuses a running dev server
npm run test:e2e:flow # opt-in: production build on :3100 + the e2e/flows/ specs on the real DB (tunnel up);
                      # emails are dry-run; [TEST] rows and test sessions are deleted in teardown

npm run db:tunnel    # SSH tunnel to the VPS MariaDB (local 127.0.0.1:3307), foreground; needed for db:* / test:db / flows
npm run db:tunnel:stop # close a background tunnel opened by npm run dev
npm run db:check     # read-only: version, session timezone (must be +00:00), tables
npm run db:generate  # drizzle-kit generate from lib/db/schema.ts into drizzle/; review the SQL
npm run db:migrate   # backs up on the VPS (scripts/db-backup.sh), then drizzle-kit migrate
npm run db:backup    # backup only: /root/backups/subastasdelsur/*.sql.gz, newest 20 kept
npm run media:backup # tar of the VPS photos (/srv/nextjs/shared/uploads) next to the DB dumps
npm run media:sweep  # list photo files with no DB row (older than 1h); --delete removes them
npm run test:db      # opt-in DB tests (ALLOW_DB_TESTS=1); writes only inside rolled-back transactions
npm run db:seed-admin # create/update the admin from ADMIN_EMAIL/ADMIN_PASSWORD (idempotent; --reset-password)
npx next typegen     # regenerate PageProps/LayoutProps route types after adding routes (else tsc errors)
```

## Code layout

- `lib/time.ts`: every wall-clock to instant conversion and every auction-time display. Never format or parse auction times anywhere else.
- `lib/db/schema.ts`: the Drizzle schema and its conventions (UTC `DATETIME(3)`, `*_cents` BIGINT, `varchar(36)` UUIDs).
- `lib/db/index.ts` (with `server-only`): what app code imports.
- `lib/db/client.ts`: the pool and `getDb()`, without the `server-only` guard, so scripts and DB tests can use it.
- `scripts/`: run with `tsx`. Without `"type": "module"` there's no top-level `await`, so wrap scripts in `main()`. They load env with `@next/env`'s `loadEnvConfig`. Vitest runs with `NODE_ENV=test`, which skips `.env.local`, so DB tests call `process.loadEnvFile`.
- Auth:
  - `lib/auth.ts` is the Better Auth config. Its `user.additionalFields` must match the `user` columns in the schema.
  - Sign-up over HTTP is disabled; registration only goes through `app/registro/actions.ts`.
  - `lib/dal.ts` (`getCurrentUser`, `requireUser`, `requireAdmin`, `checkApprovedBidder`) is the only place that reads the session. It reads the request, so callers render inside `<Suspense>`.
  - `proxy.ts` is only an optimistic cookie check.
  - Forms are Server Actions with `useActionState` (`components/form.tsx`, `FormState`). Better Auth error codes map to Spanish in `lib/auth-errors.ts`.
- `notFound()`/`redirect()` inside `<Suspense>` can't change the HTTP status, because streaming has already started. Test for the rendered 404 page, not for status 404.
- Playwright:
  - Next.js renders a hidden `role="alert"` route announcer, so filter `getByRole("alert")` by text.
  - Wait for a URL by pathname (`waitForURL(url => url.pathname === …)`), because `/entrar?next=/admin` also "ends in /admin".
  - Flow specs sign in with `adminPage()` from `e2e/flows/helpers.ts`, which records the session for teardown (`deleteTrackedSessions`).
- Decisions about time (has it started? is the start in the future?) use `dbNow()` from `lib/db/time.ts`, never `new Date()`. Mutations lock the row with `.for("update")` inside a transaction.
- Correlated subqueries: never write `${table.column}` for the *outer* row inside a `sql` subquery. In single-table selects Drizzle drops the table name, so the column binds to the inner table. Use the aliased fragments in `lib/db/aggregates.ts`, or qualify explicitly with `` `auction`.`id` ``.
- Public pages are in `app/(public)/` (shared header); admin pages are in `app/admin/` (their own layout).
  - Catalog reads (`lib/catalog.ts`) are `use cache` with tags `auctions` and `auction:<id>`. Every admin write must call `updateTag` for both.
  - Anything that depends on the current time renders per request via `requestTime()` (`lib/request-time.ts`; the react-hooks purity lint forbids `Date.now()` in components).
  - On the client, use `AuctionClock`/`useServerNow` (`components/clock.tsx`), which correct for the device clock.
  - Drafts are visible only to the admin (`getVisibleAuction` in `lib/catalog-access.ts`).
- Bidding: rules in `lib/bids.ts` (pure); the transaction and the live state in `lib/bids-db.ts`. Never change `product.current_price_cents`, `leading_bid_id` or `bid_count` outside `placeBidCore`. Live data is never cached: lot pages read it per request and poll `/api/lotes/<id>/estado`.
- Settlement (`lib/settlement-db.ts`) is the only code that emails auction results.
  - Production runs it from `instrumentation.ts` when `SETTLEMENT_WORKER=1`. Never set that flag locally or in tests: they share the production DB.
  - Tests call `settleAuction(db, id)` on their own auctions, never `settleDueAuctions`, and point `ADMIN_NOTIFICATION_EMAIL` at an `example.com` address.
- The admin's own sessions on production are real (from the live site or `next dev`). Teardown deletes only the session tokens the tests recorded (`trackSession`), never sessions by user or user agent.
- Flow specs run in parallel against one DB and one UPLOAD_DIR. Name rows with `testRunId()` (not `Date.now()`), delete only your own rows and files, and seed with `seedDraftAuction()`, `seedLiveUnlistedAuction()` and `seedBidder()`.
- If `tsc`/`build` fails on `.next/dev/types/validator.ts` after moving routes, the running `next dev` has stale types: restart it, or move `.next/dev/types` aside.
- Photos: `lib/storage.ts` (UPLOAD_DIR, sharp → WebP, `resolveKey` guards paths), served by `app/media/[...key]/route.ts`. Locally UPLOAD_DIR is `./.uploads`; the flow runner uses a temp dir. Since development uses the production DB, real photos are only uploaded on the live site.
- Permissions per auction state come from `permissions()` in `lib/auctions/rules.ts`: `editWindow`, `editProducts` (lot/prices/add/remove), `editProductContent` (text/photos) and the status actions.
- Don't put `key={updatedAt}` on a `useActionState` form that refreshes on success: it remounts and loses the success message.
- Email: `lib/email/send.ts` (`queueEmail` sends after the response). Set `EMAIL_DRY_RUN=1` to log instead of sending. Never send real emails from tests.
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
