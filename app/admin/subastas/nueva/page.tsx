import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_AUCTION_TIMEZONE } from "@/lib/time";
import { isAllowedAuctionTimeZone } from "@/lib/timezones";
import { createAuction } from "../actions";
import { AuctionForm } from "../auction-form";

export const metadata: Metadata = { title: "Nueva subasta" };

const defaultZone = process.env.AUCTION_TIMEZONE && isAllowedAuctionTimeZone(process.env.AUCTION_TIMEZONE) ? process.env.AUCTION_TIMEZONE : DEFAULT_AUCTION_TIMEZONE;

// The admin check happens in the layout gate and again in the createAuction action.
export default function NewAuctionPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/subastas" className="text-sm underline">
        ← Subastas
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nueva subasta</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Se guarda como borrador. Después agregas los productos y la publicas.</p>
      <AuctionForm
        action={createAuction}
        submitLabel="Crear borrador"
        defaults={{ title: "", description: "", timezone: defaultZone, startsAt: "", endsAt: "", listed: "on" }}
      />
    </div>
  );
}
