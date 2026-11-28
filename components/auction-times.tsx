import { LocalTime } from "@/components/clock";
import type { CatalogAuction } from "@/lib/catalog";
import { formatAuctionTime } from "@/lib/time";
import { timeZoneLabel } from "@/lib/timezones";

/** Start and end in the auction's zone (named), plus the visitor's local time. */
export function AuctionTimes({ auction }: { auction: CatalogAuction }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-sm sm:p-5"
      data-testid="auction-times"
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-zinc-500">Inicio</dt>
          <dd className="mt-0.5 font-medium first-letter:uppercase">
            {formatAuctionTime(auction.startsAt, auction.timezone)}
            <LocalTime
              instant={auction.startsAt.getTime()}
              auctionTimeZone={auction.timezone}
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-zinc-500">Cierre</dt>
          <dd className="mt-0.5 font-medium first-letter:uppercase">
            {formatAuctionTime(auction.endsAt, auction.timezone)}
            <LocalTime
              instant={auction.endsAt.getTime()}
              auctionTimeZone={auction.timezone}
            />
          </dd>
        </div>
      </dl>
      <p className="text-xs text-zinc-500">
        Horario de {timeZoneLabel(auction.timezone)}. La subasta empieza y
        termina en el mismo instante para todos.
      </p>
    </div>
  );
}
