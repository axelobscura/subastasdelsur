# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

"Subastas del sur" (an auctions site) at a very early stage: a freshly bootstrapped `create-next-app` project. Only `app/page.tsx` has been customized (a heading). `app/layout.tsx` still has the template metadata ("Create Next App") and `lang="en"`. There's no backend, data layer, auth, or test setup yet.

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
