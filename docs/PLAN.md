# Subastas del sur: implementation plan

The build plan for the auctions app. It's the source of truth for scope, data model and sequencing. When a decision changes, update this file, and tick phases off in the checklist at the bottom as they land.

## Goal

An online auctions site in Spanish:

- An **admin dashboard** where the admin creates auctions, gives each one a **date and time window** (start and end), and adds the **products (lots)** being auctioned, with **pictures**.
- A **public site** where people browse auctions and products. Registered bidders **place bids** while an auction is live.
- **The time window is the same absolute moment for everyone.** An auction that starts "5 dic 2026, 19:00" in the auction's timezone starts at that same instant whether the admin set it up from Madrid or Mexico City, and whether a bidder is in Tokyo or Buenos Aires. The timezone rules below are the core requirement. Don't shortcut them.

Out of scope for v1: online payments, proxy/automatic bidding, multiple admins with different permissions, multi-language UI.

## Stack decisions

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16.4 App Router, React 19, TS strict | Already set up. `cacheComponents` and `partialPrefetching` are on (see CLAUDE.md). |
| Database | **MariaDB 11.8** on the Hostinger production VPS (database and user `subastasdelsur`; InnoDB, utf8mb4/`utf8mb4_unicode_ci`; server and system timezone UTC) | This is the **only** database. Development uses it too (see "Environments" and "Working against the production database"). Credentials live only in `.env.local` and the VPS environment. |
| ORM / migrations | Drizzle ORM (`drizzle-orm/mysql2`, `mysqlTable`) + drizzle-kit (`dialect: 'mysql'`) with the `mysql2` driver | Schema in `lib/db/schema.ts`, migrations in `drizzle/`. Use a connection pool with `timezone: 'Z'` and run `SET time_zone = '+00:00'` on each new connection. |
| Auth | Better Auth (email + password) with a `role` column (`admin` / `bidder`) | Use its Drizzle adapter. Create the admin with a seed script, never through public sign-up. |
| Image storage | S3-compatible bucket (Cloudflare R2 or AWS S3) with presigned uploads | The browser uploads straight to the bucket, so the Server Action body limit doesn't apply. Wrapped in `lib/storage.ts` so the provider can be swapped. |
| Dates/timezones | `lib/time.ts`, built only on `Intl.DateTimeFormat` (no date library) | Node 22/24 have no `Temporal`. Never use `new Date(string)` on wall-clock input. |
| Validation | `zod` | Validate every Server Action input. |
| Live updates | Client polling of a no-store Route Handler (every 3–5 s while live) | Simple and works on any host. The app runs as a long-lived Node process on the VPS, so moving to SSE later is possible and only touches the hook. |
| Tests | Vitest (domain logic) + Playwright (E2E, with timezone emulation) | `npm test` runs the unit suite under 3 process timezones. `npm run test:db` is opt-in and rolls back its writes. Playwright projects emulate `America/Mexico_City` and `Asia/Tokyo`. |

## Environments

- **Production:** the Next.js app (`next build` + `next start`, kept alive by **pm2**, which is already installed) and MariaDB run on the same Hostinger VPS. The VPS runs **Node 22** (local dev has Node 24), so don't rely on anything newer than Node 22 and set `"engines": { "node": ">=22" }`. On the VPS the app connects to `127.0.0.1:3306`. The database port is **not** exposed to the internet. Secrets are set as environment variables on the VPS, never in the repo.
- **Local development:** uses the same production database through an SSH tunnel, `ssh -N -L 3307:127.0.0.1:3306 -i <key> <user>@<vps-host>`. Local `DATABASE_URL` points at `127.0.0.1:3307`. The SSH host, user, key path and DB credentials are in `.env.local` (`SSH_*`, `DB_*`, `DATABASE_URL`). There's no separate dev database, by the owner's decision.
- **Env files:** `.env*` is gitignored. To commit a `.env.example` (keys only), add `!.env.example` to `.gitignore`.

## Working against the production database

Dev, migrations and any DB-touching tests all run against real data, so:

- **Back up before every schema change:** run `mysqldump --single-transaction` on the VPS into a timestamped file outside the web root, and keep a few recent ones.
- **Migrations only, never `drizzle-kit push`.** `drizzle-kit generate`, read the generated SQL, then `drizzle-kit migrate`. Destructive statements (`DROP`, `ALTER … DROP COLUMN`, narrowing a type) need the owner's explicit go-ahead first.
- **No `TRUNCATE` or bulk `DELETE`** from scripts or by hand without confirmation. Seed scripts must be idempotent (upsert) and never wipe tables.
- **Unit tests don't touch the DB.** Keep the rules in `lib/time.ts` and `lib/bids.ts` as pure functions. DB-writing tests (integration and E2E) only run with `ALLOW_DB_TESTS=1`. They create records whose titles start with `[TEST]`, as `draft` auctions or with test users, and they delete what they created in teardown.
- **Test auctions must never be published** to the public site. Public queries only return `status = 'published'`, so drafts are invisible.
- **Close the tunnel when it's not in use.** The database user should only have privileges on `subastasdelsur.*`.

## Timezone rules (core requirement)

1. **Store instants, not wall-clock times.** `auction.starts_at` and `auction.ends_at` are MariaDB `DATETIME(3)` columns that always hold **UTC** (Drizzle `datetime(..., { mode: 'date', fsp: 3 })`, with the connection pinned to UTC as described in the stack table). Never use `TIMESTAMP` (it converts through the session zone and ends in 2038). Also store `auction.timezone` (an IANA name, e.g. `America/Mexico_City`), but only for display and for interpreting admin input.
2. **The auction timezone is a business setting, not the admin's browser zone.** `AUCTION_TIMEZONE=America/Mexico_City` (env) is the default for new auctions, and the admin form shows it explicitly ("Hora de: Ciudad de México").
3. **Convert admin input on the server, in the auction's timezone.** `<input type="datetime-local">` posts a zone-less string like `2026-12-05T19:00`. The server action converts it with `wallClockToInstant(value, auction.timezone)`. Neither the server's own `TZ` nor the admin's browser zone is ever involved. Because of this, the same form input gives the same instant wherever the admin is. All of this lives in `lib/time.ts`: `wallClockToInstant`, `instantToWallClock` (prefills `datetime-local`), `formatAuctionTime`, `auctionPhase` and `isValidTimeZone`. Nonexistent DST-gap times throw `NonexistentLocalTimeError`, and ambiguous ones resolve to the earlier instant.
4. **The server's database clock decides everything.** Whether an auction is upcoming, live or ended, and whether a bid is on time, is decided with the database's `UTC_TIMESTAMP(3)` inside the bid transaction. Don't use `NOW()`, because it depends on the session timezone. The client's clock and timezone never affect validity.
5. **Display shows the auction's zone and labels it.** Server-rendered dates always pass an explicit `timeZone: auction.timezone` and `timeZoneName: 'short'` to `Intl.DateTimeFormat('es-…')`. Omitting `timeZone` on the server silently uses the host's zone (often UTC) and causes hydration mismatches. A small client component may add "Tu hora local: …" after mount, using the browser's zone.
6. **Countdowns correct for clock skew.** Pages send the server's current time with the auction state. The client keeps `offset = serverNow - Date.now()` and counts down to `ends_at` using `Date.now() + offset`. A wrong device clock then can't make the timer lie. The server still has the final word (rule 4).
7. **Run the server with `TZ=UTC`** so mistakes show up early instead of only in production.
8. **Test it.** Run the `lib/time.ts` and bid-window unit tests under `TZ=UTC`, `TZ=Asia/Tokyo` and `TZ=America/Los_Angeles`, and check they give identical results. A Playwright test creates an auction from a browser emulating one timezone (`timezoneId`) and checks the start time and bid acceptance from a browser in another.

## Data model (Drizzle)

Money is stored as integer cents (`*_cents`) in one currency (`CURRENCY` env), as `BIGINT`. All instants are UTC `DATETIME(3)`. Tables are InnoDB (needed for transactions and row locks) and utf8mb4. IDs are `CHAR(36)` UUIDs or `BIGINT AUTO_INCREMENT`; pick one in phase 0 and use it everywhere. Better Auth's tables use its own ID format. MariaDB 11.8 enforces `CHECK` constraints.

- **Better Auth tables** (`user`, `session`, `account`, `verification`), with `user.role` (`'admin' | 'bidder'`, default `'bidder'`).
- **`auction`**: `id`, `slug` (unique), `title`, `description`, `status` (`'draft' | 'published' | 'cancelled'`), `starts_at`, `ends_at`, `timezone`, `created_by`, `created_at`, `updated_at`. Check constraint: `ends_at > starts_at`.
  - The *phase* (upcoming / live / ended) is **derived** from `status` + times + now. It's never stored, so no cron job is needed to "open" or "close" an auction.
- **`product`** (a lot): `id`, `auction_id` (FK, cascade), `lot_number`, `title`, `description`, `starting_price_cents`, `min_increment_cents`, `reserve_price_cents` (nullable), `current_price_cents` (nullable), `leading_bid_id` (nullable), `bid_count` (default 0), `position`, timestamps.
  - The current price and leading bid are denormalized so pages and polling read one row. They're only written inside the bid transaction.
- **`product_image`**: `id`, `product_id` (FK, cascade), `storage_key`, `width`, `height`, `alt`, `position`. The image at position 0 is the cover.
- **`bid`**: `id`, `product_id` (FK), `user_id` (FK), `amount_cents`, `created_at` (set to `UTC_TIMESTAMP(3)` in the insert, the server's clock). Unique `(product_id, amount_cents)` so ties are impossible. Index `(product_id, created_at desc)`.

## Bidding rules

Bids go through Server Action `placeBid(productId, amountCents)` in `lib/bids.ts` (pure rule functions) and `app/…/actions.ts` (wiring):

1. `requireUser()` from the DAL. The user must be a bidder, not an admin.
2. In one transaction: `SELECT … FROM product JOIN auction … FOR UPDATE` (the product row is the lock).
3. Reject the bid unless `auction.status = 'published'` and `starts_at <= UTC_TIMESTAMP(3) < ends_at`, using the DB's clock (the `FOR UPDATE` lock needs InnoDB).
4. The minimum is `starting_price` for the first bid, then `current_price + min_increment`. Reject if `amount < minimum`. Also reject if the bidder already holds the leading bid.
5. Insert the bid, then update `product.current_price_cents`, `leading_bid_id` and `bid_count`.
6. Return the new state, or a typed error (`'not_live' | 'too_low' | 'already_leading' | 'unauthenticated'`) shown in Spanish.

At close, the winner is the leading bid, if it's at or above the reserve. Nothing needs to run at the exact moment of closing, because the phase is derived. A closing job (or a lazy check when the admin opens results) records outcomes and sends notifications.

Later: soft close (anti-sniping, where a bid in the last N minutes pushes back that product's end) would add `product.ends_at` (nullable, falling back to the auction's) and change rule 3 to use the product's end.

## Admin rules

- Only `role = 'admin'`. Every Server Action and Route Handler re-checks with `requireAdmin()` from `lib/dal.ts` (`import 'server-only'`). `proxy.ts` only does the optimistic redirect to `/entrar`.
- Auctions are created as `draft`. Publishing requires at least one product with at least one image, and a start time in the future.
- Once an auction is **live or ended**, its times, prices and product list are locked. Only text, images and cancelling stay editable. Cancelling a live auction needs confirmation and notifies bidders (phase 6).
- Image upload: the client asks `createUploadUrl(productId, contentType, size)` (an admin Server Action) for a presigned PUT, uploads directly, then calls `attachImage(productId, key, width, height)`. Allow `image/jpeg|png|webp|avif` only, max ~10 MB, up to ~12 images per product. Reorder and delete in the UI. Delete the object from the bucket when its row is deleted.
- Add the bucket's public host to `images.remotePatterns` in `next.config.ts`, then render with `next/image`.

## Routes (Spanish URLs)

```
app/
  page.tsx                                  # home: live and upcoming auctions
  subastas/page.tsx                         # all auctions (tabs: en vivo / próximas / finalizadas)
  subastas/[slug]/page.tsx                  # auction: times, countdown, product grid
  subastas/[slug]/[lote]/page.tsx           # product: gallery, live price, bid form, bid history
  entrar/ registro/ mi-cuenta/              # auth + "mis pujas"
  admin/layout.tsx                          # requireAdmin(); dashboard shell
  admin/page.tsx                            # auctions table + status
  admin/subastas/nueva/page.tsx             # create auction (title, description, window, timezone)
  admin/subastas/[id]/page.tsx              # edit auction, manage products, publish/cancel
  admin/subastas/[id]/productos/[pid]/page.tsx  # product form + image manager
  admin/subastas/[id]/resultados/page.tsx   # winners per product (after close)
  api/auth/[...all]/route.ts                # Better Auth handler
  api/productos/[id]/estado/route.ts        # no-store live state for polling
lib/
  db/schema.ts, db/index.ts                 # Drizzle
  auth.ts, dal.ts                           # Better Auth config; server-only session/role checks
  time.ts                                   # the timezone rules above (unit-tested)
  bids.ts                                   # bid rules (unit-tested)
  storage.ts                                # presign / delete
proxy.ts                                    # optimistic auth redirects for /admin and /mi-cuenta
scripts/seed-admin.ts                       # create the admin user
```

## Caching with Cache Components

- **Cached** (`'use cache'` + `cacheTag`): auction and product *catalog* data (titles, descriptions, images, times), tagged `auction:<id>`, `product:<id>` and `auctions`. Admin Server Actions call `updateTag(...)` after writes, so the admin sees changes immediately.
- **Never cached:** the live price, bid count, leading bidder, the current phase, and anything per-user. Read these from the no-store state route (polling) or in a dynamic component behind `<Suspense>`.
- **The phase (en vivo / finalizada) must not be baked into cached output,** because it changes with time, not with data. Render the badge in a client component from `starts_at`, `ends_at` and the server time offset (timezone rule 6).
- Read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` and `02-guides/authentication-with-cache-components.md` before building these pages.

## Phases

Each phase ends with `npm run lint`, `npx tsc --noEmit`, the tests and a manual check in `npm run dev`.

0. **Foundations.** Add dependencies, set up Drizzle with a MariaDB connection (`mysql2` pool, UTC-pinned, `DATABASE_URL`) and the first migration (backup first), `.env.example`, `lib/time.ts` and its multi-timezone Vitest suite, Playwright set up with one smoke test, and `TZ=UTC` in the scripts.
1. **Auth and roles.** Better Auth, the role column, `lib/dal.ts` (`getSession`, `requireUser`, `requireAdmin`), `proxy.ts`, `/entrar` and `/registro`, and `scripts/seed-admin.ts`.
2. **Admin: auctions.** Create, edit and list auctions. A window form with `datetime-local` and a timezone select, converted on the server per the timezone rules. Draft, publish and cancel with the publish checks. Times locked once live.
3. **Admin: products and images.** Product CRUD inside an auction (lot number, prices, increment, reserve), presigned image uploads, reorder and cover image, `remotePatterns`.
4. **Public catalog.** Home, the auctions list with tabs, and the auction and product pages with the cached catalog data, labelled times plus local time, and a countdown with skew correction.
5. **Bidding.** `lib/bids.ts` rules plus Vitest tests, the `placeBid` transaction, the state route, a polling hook (fast while live, stopped once ended), the bid form with useful errors, the bid history, and "mis pujas" in `/mi-cuenta`.
6. **Closing and results.** Admin results page (winner, reserve met or not), a closing job or lazy settlement, email notifications to winners and outbid bidders (provider to be chosen), and auctions marked finalizada.
7. **Hardening.** Rate-limit `placeBid` per user, an audit log of admin changes, the cross-timezone Playwright test from rule 8, accessibility and mobile pass, and Spanish metadata/OG images per auction. Soft close if wanted.

## Open decisions

Confirm these with the owner before the phase that needs them:

- ~~Auction timezone~~: decided. `America/Mexico_City`. Mexico has had no DST since 2022, but keep the DST handling in `lib/time.ts` in case the rule or a per-auction zone changes.
- ~~Hosting~~: decided. App and database on the Hostinger production VPS.
- ~~Database engine~~: decided. MariaDB 11.8 on the VPS.
- ~~Dev database~~: decided. None; development uses the production database (safety rules in "Working against the production database").
- **Image storage** (phase 3): R2 or S3 bucket, or the VPS disk (for example `/var/www/subastasdelsur-uploads` served by the web server, with the same `lib/storage.ts` interface). The disk is simpler but needs its own backups and counts against the VPS's space.
- **Currency** (phase 3): MXN, ARS, CLP, USD…
- **Bidder sign-up** (phase 1): open sign-up with email verification, or admin-approved bidders? Is a phone number or ID required?
- **Bid rules** (phase 5): can someone bid if they're already leading? Fixed increment per product or price-tiered increments? Is the reserve shown publicly?
- **Soft close** (phase 7): wanted, and for how many minutes?

## Progress

- [x] 0 Foundations (2026-11-27): migration `0000_init` applied to production, with `auction`, `product` and `product_image`. Not yet created: the Better Auth tables, `auction.created_by` (phase 1), and the `bid` table plus the `product.leading_bid_id` FK (phase 5).
- [ ] 1 Auth and roles
- [ ] 2 Admin: auctions
- [ ] 3 Admin: products and images
- [ ] 4 Public catalog
- [ ] 5 Bidding
- [ ] 6 Closing and results
- [ ] 7 Hardening
