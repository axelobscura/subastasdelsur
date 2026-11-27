# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Implementation plan

The full build plan covers scope, stack, data model, timezone rules, bidding rules, routes, phases and open decisions:

@docs/PLAN.md

Follow it, and keep its "Progress" checklist and "Open decisions" up to date as work lands. The timezone rules are the app's core requirement. Every auction instant is stored in UTC, admin input is interpreted in the auction's timezone on the server, and bid validity uses only the database clock.

**The only database is the production MariaDB on the VPS. Development uses it too.** Before running any migration, seed, test or SQL against it, follow "Working against the production database" in the plan: back up first, migrations only, no destructive SQL without the owner's go-ahead. Connection and SSH details are in `.env.local` (gitignored). Never copy them into tracked files.

## Project state

"Subastas del sur" (an auctions site) at a very early stage: a freshly bootstrapped `create-next-app` project. So far only `app/page.tsx` (a heading) and the metadata and `lang="es"` in `app/layout.tsx` have been customized. The site is in Spanish. There's no backend, data layer, auth, or test setup yet.

## Commands

```bash
npm run dev      # dev server on http://localhost:3000 (also re-writes the AGENTS.md block)
npm run build    # production build; also the main type/prerender check
npm run start    # serve the production build
npm run lint     # ESLint 9 flat config (next core-web-vitals + typescript)
npx tsc --noEmit # type-check only
```

There is no test runner configured.

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
