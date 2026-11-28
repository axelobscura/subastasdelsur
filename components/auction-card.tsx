import Image from "next/image";
import Link from "next/link";
import { AuctionClock } from "@/components/clock";
import type { CatalogAuction } from "@/lib/catalog";
import { mediaUrl } from "@/lib/storage";
import { formatAuctionTimeShort } from "@/lib/time";

export function AuctionCard({ auction, serverNow }: { auction: CatalogAuction; serverNow: number }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-brand">
      <Link href={`/subastas/${auction.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
          {auction.cover ? (
            <Image src={mediaUrl(auction.cover.key)} alt="" fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          ) : (
            <NoPhoto />
          )}
          <span className="absolute right-3 bottom-3 rounded-md bg-board/85 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {auction.productCount} {auction.productCount === 1 ? "lote" : "lotes"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="font-display text-2xl leading-tight group-hover:text-brand">{auction.title}</h3>
          <AuctionClock startsAt={auction.startsAt.getTime()} endsAt={auction.endsAt.getTime()} serverNow={serverNow} status={auction.status} />
          <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
            <div>
              <dt className="text-zinc-500">Abre</dt>
              <dd className="font-medium text-zinc-800 dark:text-zinc-200">{formatAuctionTimeShort(auction.startsAt, auction.timezone)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Cierra</dt>
              <dd className="font-medium text-zinc-800 dark:text-zinc-200">{formatAuctionTimeShort(auction.endsAt, auction.timezone)}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </article>
  );
}

/** Placeholder for a picture that isn't there: the gavel outline, faint. */
export function NoPhoto() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-zinc-300 dark:text-zinc-700" aria-hidden>
      <svg viewBox="0 0 48 48" className="size-14" fill="currentColor">
        <g transform="translate(26 17) rotate(-33)">
          <rect x="-22" y="-1.6" width="20" height="3.2" rx="1.6" />
          <rect x="-5" y="-9" width="10" height="18" rx="1.5" />
        </g>
        <rect x="26" y="30" width="16" height="4" rx="1.5" />
      </svg>
    </div>
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
