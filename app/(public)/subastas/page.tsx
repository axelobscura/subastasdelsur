import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuctionGrid } from "@/components/auction-card";
import { pillClass, pillTrayClass } from "@/components/nav-link";
import { Skeleton } from "@/components/ui";
import { groupByPhase } from "@/lib/auctions/rules";
import { getPublishedAuctions } from "@/lib/catalog";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Subastas" };

const TABS = {
  "en-vivo": { label: "En vivo", group: "live", empty: "No hay subastas en vivo en este momento." },
  proximas: { label: "Próximas", group: "upcoming", empty: "No hay subastas programadas por ahora." },
  finalizadas: { label: "Finalizadas", group: "ended", empty: "Todavía no hay subastas finalizadas." },
} as const;
type Tab = keyof typeof TABS;

export default function AuctionsPage({ searchParams }: PageProps<"/subastas">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-5xl">Subastas</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Todas las subastas abren y cierran a la misma hora para todos los postores.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <AuctionTabs searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AuctionTabs({ searchParams }: { searchParams: PageProps<"/subastas">["searchParams"] }) {
  const { estado } = await searchParams;
  const now = await requestTime();
  const groups = groupByPhase(await getPublishedAuctions(), now);
  // Default: live auctions if there are any, otherwise upcoming ones.
  const tab: Tab = typeof estado === "string" && estado in TABS ? (estado as Tab) : groups.live.length ? "en-vivo" : "proximas";
  const auctions = groups[TABS[tab].group];

  return (
    <>
      <nav aria-label="Estado de las subastas" className={`${pillTrayClass} self-start overflow-x-auto`}>
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <Link
            key={key}
            href={`/subastas?estado=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={pillClass}
          >
            {TABS[key].label} ({groups[TABS[key].group].length})
          </Link>
        ))}
      </nav>
      {auctions.length ? (
        <AuctionGrid auctions={auctions} serverNow={now.getTime()} />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-surface p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">{TABS[tab].empty}</p>
      )}
    </>
  );
}
