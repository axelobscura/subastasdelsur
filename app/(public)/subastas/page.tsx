import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuctionGrid } from "@/components/auction-card";
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
      <h1 className="text-3xl font-semibold tracking-tight">Subastas</h1>
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
      <nav aria-label="Estado de las subastas" className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <Link
            key={key}
            href={`/subastas?estado=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className="rounded-full border border-zinc-300 px-3 py-1 aria-[current=page]:border-zinc-900 aria-[current=page]:bg-zinc-900 aria-[current=page]:text-white dark:border-zinc-700 dark:aria-[current=page]:border-zinc-100 dark:aria-[current=page]:bg-zinc-100 dark:aria-[current=page]:text-zinc-900"
          >
            {TABS[key].label} ({groups[TABS[key].group].length})
          </Link>
        ))}
      </nav>
      {auctions.length ? (
        <AuctionGrid auctions={auctions} serverNow={now.getTime()} />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">{TABS[tab].empty}</p>
      )}
    </>
  );
}
