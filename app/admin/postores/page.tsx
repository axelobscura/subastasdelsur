import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { bidderTabs, listBidders, parseBidderTab, type BidderTab } from "@/lib/admin/bidders";
import { DEFAULT_AUCTION_TIMEZONE, formatAuctionTime } from "@/lib/time";

export const metadata: Metadata = { title: "Postores" };

export default function BiddersPage({ searchParams }: PageProps<"/admin/postores">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Postores</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <BiddersTabs searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BiddersTabs({ searchParams }: { searchParams: PageProps<"/admin/postores">["searchParams"] }) {
  const tab = parseBidderTab((await searchParams).estado);
  const bidders = await listBidders(tab);
  return (
    <>
      <nav aria-label="Estado" className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(bidderTabs) as BidderTab[]).map((key) => (
          <Link
            key={key}
            href={`/admin/postores?estado=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className="rounded-full border border-zinc-300 px-3 py-1 aria-[current=page]:border-zinc-900 aria-[current=page]:bg-zinc-900 aria-[current=page]:text-white dark:border-zinc-700 dark:aria-[current=page]:border-zinc-100 dark:aria-[current=page]:bg-zinc-100 dark:aria-[current=page]:text-zinc-900"
          >
            {bidderTabs[key].label}
          </Link>
        ))}
      </nav>

      {bidders.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No hay postores en esta lista.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Correo</th>
                <th className="px-4 py-2 font-medium">Teléfono</th>
                <th className="px-4 py-2 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody>
              {bidders.map((b) => (
                <tr key={b.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <Link href={`/admin/postores/${b.id}`} className="font-medium underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{b.email}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{b.phone}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{formatAuctionTime(b.createdAt, DEFAULT_AUCTION_TIMEZONE)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
