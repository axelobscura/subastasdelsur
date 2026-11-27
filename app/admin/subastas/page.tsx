import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice, Skeleton } from "@/components/ui";
import { listAuctions } from "@/lib/admin/auctions";
import { DISPLAY_STATE_LABELS, displayState } from "@/lib/auctions/rules";
import { formatAuctionTimeShort } from "@/lib/time";
import { StateBadge } from "./state-badge";

export const metadata: Metadata = { title: "Subastas" };

export default function AuctionsPage({ searchParams }: PageProps<"/admin/subastas">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Subastas</h1>
        <Link
          href="/admin/subastas/nueva"
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Nueva subasta
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <AuctionsTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AuctionsTable({ searchParams }: { searchParams: PageProps<"/admin/subastas">["searchParams"] }) {
  const [{ eliminada }, { auctions, now }] = await Promise.all([searchParams, listAuctions()]);
  return (
    <>
      {eliminada ? <Notice tone="success">Borrador eliminado.</Notice> : null}
      {auctions.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">Todavía no hay subastas. Crea la primera con «Nueva subasta».</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Subasta</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Inicio</th>
                <th className="px-4 py-2 font-medium">Cierre</th>
                <th className="px-4 py-2 text-right font-medium">Productos</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((a) => {
                const state = displayState(a, now);
                return (
                  <tr key={a.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-2">
                      <Link href={`/admin/subastas/${a.id}`} className="font-medium underline">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <StateBadge state={state} label={DISPLAY_STATE_LABELS[state]} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatAuctionTimeShort(a.startsAt, a.timezone)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatAuctionTimeShort(a.endsAt, a.timezone)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{a.productCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
