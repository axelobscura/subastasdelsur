import { LocalTime } from "@/components/clock";
import type { CatalogAuction } from "@/lib/catalog";
import { formatAuctionTime } from "@/lib/time";
import { timeZoneLabel } from "@/lib/timezones";

/** Start and end in the auction's zone (named), plus the visitor's local time. */
export function AuctionTimes({ auction }: { auction: CatalogAuction }) {
  return (
    <dl className="grid gap-3 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-2 dark:border-zinc-800" data-testid="auction-times">
      <div>
        <dt className="font-medium">Inicio</dt>
        <dd>
          {formatAuctionTime(auction.startsAt, auction.timezone)}
          <LocalTime instant={auction.startsAt.getTime()} auctionTimeZone={auction.timezone} />
        </dd>
      </div>
      <div>
        <dt className="font-medium">Cierre</dt>
        <dd>
          {formatAuctionTime(auction.endsAt, auction.timezone)}
          <LocalTime instant={auction.endsAt.getTime()} auctionTimeZone={auction.timezone} />
        </dd>
      </div>
      <p className="text-xs text-zinc-500 sm:col-span-2">Horario de {timeZoneLabel(auction.timezone)}. La subasta empieza y termina en el mismo instante para todos.</p>
    </dl>
  );
}
