import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionTimes } from "@/components/auction-times";
import { AuctionClock } from "@/components/clock";
import { Notice, Skeleton } from "@/components/ui";
import { getAuctionLiveSummary } from "@/lib/bids-db";
import { getCatalogProducts } from "@/lib/catalog";
import { getPublicAuctionTitle, getVisibleAuction } from "@/lib/catalog-access";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { requestTime } from "@/lib/request-time";
import { mediaUrl } from "@/lib/storage";

type Props = PageProps<"/subastas/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const title = await getPublicAuctionTitle((await params).slug);
  return title ? { title } : {};
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

      <header className="flex flex-col gap-3">
        <Link href="/subastas" className="text-sm underline">
          ← Subastas
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{auction.title}</h1>
        <AuctionClock startsAt={auction.startsAt.getTime()} endsAt={auction.endsAt.getTime()} serverNow={serverNow} status={auction.status} size="lg" />
      </header>

      <AuctionTimes auction={auction} />
      {auction.description ? <p className="max-w-3xl whitespace-pre-line text-zinc-700 dark:text-zinc-300">{auction.description}</p> : null}

      <section aria-labelledby="lotes" className="flex flex-col gap-4">
        <h2 id="lotes" className="text-2xl font-semibold tracking-tight">
          Lotes ({products.length})
        </h2>
        {products.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/subastas/${auction.slug}/${p.lotNumber}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
                    {p.images[0] ? (
                      <Image src={mediaUrl(p.images[0].key)} alt={p.images[0].alt || p.title} fill sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 p-4">
                    <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Lote {p.lotNumber}</p>
                    <h3 className="font-semibold group-hover:underline">{p.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {live.get(p.id)?.bidCount && live.get(p.id)?.currentPriceCents != null
                        ? `Puja actual ${formatMoney(live.get(p.id)!.currentPriceCents!)} · ${live.get(p.id)!.bidCount} ${live.get(p.id)!.bidCount === 1 ? "puja" : "pujas"}`
                        : `Precio de salida ${formatMoney(p.startingPriceCents)}`}
                    </p>
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
