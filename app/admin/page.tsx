import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { auctionCounts } from "@/lib/admin/auctions";
import { bidderCounts } from "@/lib/admin/bidders";

export const metadata: Metadata = { title: "Panel de administración" };

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
      <Suspense fallback={<Skeleton className="h-28" />}>
        <AuctionSummary />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-28" />}>
        <BidderSummary />
      </Suspense>
    </div>
  );
}

function SummaryCards({ cards }: { cards: { label: string; value: number; href: string; highlight?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={`rounded-lg border p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${c.highlight ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" : "border-zinc-200 dark:border-zinc-800"}`}
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{c.value}</p>
        </Link>
      ))}
    </div>
  );
}

async function AuctionSummary() {
  const counts = await auctionCounts();
  return (
    <section aria-labelledby="subastas-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="subastas-title" className="text-lg font-medium">
          Subastas
        </h2>
        <Link href="/admin/subastas/nueva" className="text-sm font-medium underline">
          Nueva subasta
        </Link>
      </div>
      <SummaryCards
        cards={[
          { label: "En vivo", value: counts.live, href: "/admin/subastas", highlight: counts.live > 0 },
          { label: "Programadas", value: counts.upcoming, href: "/admin/subastas" },
          { label: "Borradores", value: counts.draft, href: "/admin/subastas" },
          { label: "Finalizadas", value: counts.ended, href: "/admin/subastas" },
        ]}
      />
    </section>
  );
}

async function BidderSummary() {
  const counts = await bidderCounts();
  const cards = [
    { label: "Por aprobar", value: counts.pending, href: "/admin/postores?estado=pendientes", highlight: counts.pending > 0 },
    { label: "Aprobados", value: counts.approved, href: "/admin/postores?estado=aprobados" },
    { label: "Rechazados", value: counts.rejected, href: "/admin/postores?estado=rechazados" },
    { label: "Sin confirmar correo", value: counts.unverified, href: "/admin/postores?estado=sin-confirmar" },
  ];
  return (
    <section aria-labelledby="postores-title" className="flex flex-col gap-3">
      <h2 id="postores-title" className="text-lg font-medium">
        Postores
      </h2>
      <SummaryCards cards={cards} />
    </section>
  );
}
