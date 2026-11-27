import Image from "next/image";
import Link from "next/link";
import { AuctionClock } from "@/components/clock";
import type { CatalogAuction } from "@/lib/catalog";
import { mediaUrl } from "@/lib/storage";
import { formatAuctionTimeShort } from "@/lib/time";

export function AuctionCard({ auction, serverNow }: { auction: CatalogAuction; serverNow: number }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <Link href={`/subastas/${auction.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
          {auction.cover ? (
            <Image src={mediaUrl(auction.cover.key)} alt="" fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="text-lg font-semibold tracking-tight group-hover:underline">{auction.title}</h3>
          <AuctionClock startsAt={auction.startsAt.getTime()} endsAt={auction.endsAt.getTime()} serverNow={serverNow} status={auction.status} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {formatAuctionTimeShort(auction.startsAt, auction.timezone)} → {formatAuctionTimeShort(auction.endsAt, auction.timezone)}
          </p>
          <p className="mt-auto text-sm text-zinc-500">
            {auction.productCount} {auction.productCount === 1 ? "lote" : "lotes"}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function AuctionGrid({ auctions, serverNow }: { auctions: CatalogAuction[]; serverNow: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {auctions.map((a) => (
        <AuctionCard key={a.id} auction={a} serverNow={serverNow} />
      ))}
    </div>
  );
}
