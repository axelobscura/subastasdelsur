import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { Notice, Skeleton } from "@/components/ui";
import { getAuctionResults } from "@/lib/admin/results";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { LOT_OUTCOME_LABELS, type LotOutcome } from "@/lib/settlement";
import { settleAuction } from "@/lib/settlement-db";
import { formatAuctionTimeShort } from "@/lib/time";

export const metadata: Metadata = { title: "Resultados" };

const OUTCOME_STYLE: Record<LotOutcome, string> = {
  sold: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  reserve_not_met: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  no_bids: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

type Props = PageProps<"/admin/subastas/[id]/resultados">;

export default function ResultsPage({ params }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Results params={params} />
      </Suspense>
    </div>
  );
}

async function Results({ params }: { params: Props["params"] }) {
  const { id } = await params;
  const results = await getAuctionResults(id);
  if (!results) notFound();
  const { auction, phase, lots, summary } = results;
  const ended = auction.status === "published" && phase === "ended";
  // Backup for the worker: settle (emails) right after this response if it hasn't happened yet.
  if (ended && !auction.settledAt) {
    after(() =>
      settleAuction(getDb(), auction.id).catch((error: unknown) => console.error(`[settlement] from results page failed: ${error instanceof Error ? error.message : error}`)),
    );
  }

  return (
    <>
      <Link href={`/admin/subastas/${auction.id}`} className="text-sm underline">
        ← {auction.title}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Resultados: {auction.title}</h1>
        <a href={`/admin/subastas/${auction.id}/resultados/csv`} className="text-sm font-medium underline" download>
          Descargar CSV
        </a>
      </div>

      {auction.status === "cancelled" ? (
        <Notice tone="danger">Esta subasta fue cancelada: no hay ganadores.</Notice>
      ) : !ended ? (
        <Notice tone="warning" title="Resultados parciales">
          La subasta {phase === "live" ? "sigue en curso" : "todavía no empieza"}: se muestran las pujas más altas por ahora. Cierra el {formatAuctionTimeShort(auction.endsAt, auction.timezone)}.
        </Notice>
      ) : auction.settledAt ? (
        <Notice tone="success">Subasta finalizada. Avisos enviados a los postores el {formatAuctionTimeShort(auction.settledAt, auction.timezone)}.</Notice>
      ) : (
        <Notice tone="info">Subasta finalizada. Enviando los avisos a los postores…</Notice>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="results-summary">
        {[
          ["Vendidos", `${summary.sold} de ${summary.lots}`],
          ["Total vendido", formatMoney(summary.totalSoldCents)],
          ["Reserva no alcanzada", String(summary.reserveNotMet)],
          ["Sin pujas", String(summary.noBids)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm" data-testid="results-table">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Lote</th>
              <th className="px-3 py-2 font-medium">Resultado</th>
              <th className="px-3 py-2 font-medium">Precio final</th>
              <th className="px-3 py-2 font-medium">Pujas</th>
              <th className="px-3 py-2 font-medium">{ended ? "Ganador" : "Puja más alta"}</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.productId} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link href={`/admin/subastas/${auction.id}/productos/${lot.productId}`} className="underline">
                    {lot.lotNumber}. {lot.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${OUTCOME_STYLE[lot.outcome]}`}>{LOT_OUTCOME_LABELS[lot.outcome]}</span>
                </td>
                <td className="px-3 py-2 tabular-nums">{lot.currentPriceCents === null ? "—" : formatMoney(lot.currentPriceCents)}</td>
                <td className="px-3 py-2 tabular-nums">{lot.bidCount}</td>
                <td className="px-3 py-2">
                  {lot.leader ? (
                    <>
                      {lot.leader.name}
                      <span className="block text-xs text-zinc-500">
                        <a href={`mailto:${lot.leader.email}`} className="underline">
                          {lot.leader.email}
                        </a>
                        {lot.leader.phone ? ` · ${lot.leader.phone}` : ""}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
