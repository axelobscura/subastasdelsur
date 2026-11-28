import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NoPhoto } from "@/components/auction-card";
import { AuctionTimes } from "@/components/auction-times";
import { AuctionClock } from "@/components/clock";
import { CountdownBoard } from "@/components/countdown-board";
import { LotTag, Notice, Skeleton } from "@/components/ui";
import { getAuctionLiveSummary } from "@/lib/bids-db";
import { getCatalogProducts } from "@/lib/catalog";
import { getPublicAuctionMeta, getVisibleAuction } from "@/lib/catalog-access";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requestTime } from "@/lib/request-time";
import { mediaUrl } from "@/lib/storage";
import { formatAuctionTimeShort } from "@/lib/time";

type Props = PageProps<"/subastas/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = await getPublicAuctionMeta((await params).slug);
  return meta ? { title: meta.title, description: meta.description, openGraph: { title: meta.title, description: meta.description } } : {};
}

export default function AuctionPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AuctionView params={params} />
      </Suspense>
    </main>
  );
}

async function AuctionView({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const visible = await getVisibleAuction(slug);
  if (!visible) notFound();
  const { auction, preview } = visible;
  const serverNow = (await requestTime()).getTime();
  const [products, live] = await Promise.all([getCatalogProducts(auction.id), getAuctionLiveSummary(getDb(), auction.id)]);

  return (
    <>
      {preview ? (
        <Notice tone="warning" title="Vista previa">
          Esta subasta es un borrador: solo tú (administrador) puedes verla. <Link href={`/admin/subastas/${auction.id}`} className="underline">Volver a editarla</Link>
        </Notice>
      ) : null}
      {auction.status === "cancelled" ? <Notice tone="danger" title="Subasta cancelada">Esta subasta fue cancelada y no recibirá pujas.</Notice> : null}

      {/* Phones: intro, countdown, times. Desktop: intro and times on the left, countdown on the right. */}
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-x-10">
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <Link href="/subastas" className="self-start text-sm font-medium text-brand hover:underline">
            ← Todas las subastas
          </Link>
          <h1 className="font-display text-4xl leading-[1.02] sm:text-5xl">{auction.title}</h1>
          <AuctionClock startsAt={auction.startsAt.getTime()} endsAt={auction.endsAt.getTime()} serverNow={serverNow} status={auction.status} size="lg" showCountdown={false} />
          {auction.description ? <p className="max-w-2xl whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300">{auction.description}</p> : null}
        </div>
        <div className="flex flex-col gap-5 self-start rounded-2xl bg-board p-5 text-white sm:p-7 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <CountdownBoard startsAt={auction.startsAt.getTime()} endsAt={auction.endsAt.getTime()} serverNow={serverNow} status={auction.status} size="lg" />
          <p className="border-t border-board-line pt-4 text-sm text-zinc-300">
            {products.length} {products.length === 1 ? "lote" : "lotes"}. Cierra el {formatAuctionTimeShort(auction.endsAt, auction.timezone)}
          </p>
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <AuctionTimes auction={auction} />
        </div>
      </header>

      <section aria-labelledby="lotes" className="flex flex-col gap-4">
        <h2 id="lotes" className="font-display border-b border-line pb-3 text-3xl sm:text-4xl">
          Lotes <span className="text-zinc-500">({products.length})</span>
        </h2>
        {products.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/subastas/${auction.slug}/${p.lotNumber}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-brand"
                >
                  <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
                    {p.images[0] ? (
                      <Image src={mediaUrl(p.images[0].key)} alt={p.images[0].alt || p.title} fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                    ) : (
                      <NoPhoto />
                    )}
                    <LotTag number={p.lotNumber} className="absolute top-3 left-3" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <h3 className="text-lg leading-snug font-semibold group-hover:text-brand">{p.title}</h3>
                    <LotPrice
                      startingPriceCents={p.startingPriceCents}
                      currentPriceCents={live.get(p.id)?.currentPriceCents ?? null}
                      bidCount={live.get(p.id)?.bidCount ?? 0}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">Esta subasta todavía no tiene lotes.</p>
        )}
      </section>
    </>
  );
}

function LotPrice({ startingPriceCents, currentPriceCents, bidCount }: { startingPriceCents: number; currentPriceCents: number | null; bidCount: number }) {
  const hasBids = bidCount > 0 && currentPriceCents !== null;
  return (
    <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
      <p>
        <span className="block text-xs text-zinc-500">{hasBids ? "Puja actual" : "Precio de salida"}</span>{" "}
        <span className="font-display block text-2xl leading-tight tabular-nums">{formatMoney(hasBids ? currentPriceCents! : startingPriceCents)}</span>
      </p>
      <p className="pb-1 text-xs text-zinc-500">{bidCount === 0 ? "Sin pujas" : bidCount === 1 ? "1 puja" : `${bidCount} pujas`}</p>
    </div>
  );
}
