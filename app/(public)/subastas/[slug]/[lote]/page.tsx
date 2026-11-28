import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionTimes } from "@/components/auction-times";
import { Gallery } from "@/components/gallery";
import { IconArrowLeft, IconChevronLeft, IconChevronRight } from "@/components/icons";
import { LiveLot, type Viewer } from "@/components/live-lot";
import { LotTag, Notice, Skeleton } from "@/components/ui";
import { getAuctionBySlug, getCatalogProduct, getNeighbourLots } from "@/lib/catalog";
import { getVisibleAuction } from "@/lib/catalog-access";
import { getLotState } from "@/lib/bids-db";
import { getCurrentUser } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { mediaUrl } from "@/lib/storage";

type Props = PageProps<"/subastas/[slug]/[lote]">;

function parseLot(value: string): number | null {
  return /^\d{1,4}$/.test(value) ? Number(value) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, lote } = await params;
  const auction = await getAuctionBySlug(slug);
  const lot = parseLot(lote);
  if (!auction || auction.status === "draft" || lot === null) return {};
  const found = await getCatalogProduct(auction.id, lot);
  if (!found) return {};
  const title = `Lote ${found.lotNumber}: ${found.title} · ${auction.title}`;
  const description = `${found.description.trim().replace(/\s+/g, " ").slice(0, 150) || found.title}. Precio de salida ${formatMoney(found.startingPriceCents)}.`;
  return { title, description, openGraph: { title, description } };
}

export default function LotPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <LotView params={params} />
      </Suspense>
    </main>
  );
}

async function LotView({ params }: { params: Props["params"] }) {
  const { slug, lote } = await params;
  const lot = parseLot(lote);
  const visible = lot === null ? null : await getVisibleAuction(slug);
  if (!visible || lot === null) notFound();
  const { auction, preview } = visible;
  const [item, neighbours] = await Promise.all([getCatalogProduct(auction.id, lot), getNeighbourLots(auction.id, lot)]);
  if (!item) notFound();

  return (
    <>
      {preview ? (
        <Notice tone="warning" title="Vista previa">
          Esta subasta es un borrador: solo tú (administrador) puedes verla.
        </Notice>
      ) : null}
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={`/subastas/${auction.slug}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
          <IconArrowLeft aria-hidden className="size-4 shrink-0" />
          {auction.title}
        </Link>
        <span className="flex gap-2">
          {neighbours.previous !== null ? (
            <Link
              href={`/subastas/${auction.slug}/${neighbours.previous}`}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface py-1.5 pr-3 pl-2 font-medium hover:border-brand"
            >
              <IconChevronLeft aria-hidden className="size-4 shrink-0" />
              <span className="sr-only">Anterior: </span>Lote {neighbours.previous}
            </Link>
          ) : null}
          {neighbours.next !== null ? (
            <Link
              href={`/subastas/${auction.slug}/${neighbours.next}`}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface py-1.5 pr-2 pl-3 font-medium hover:border-brand"
            >
              <span className="sr-only">Siguiente: </span>Lote {neighbours.next}
              <IconChevronRight aria-hidden className="size-4 shrink-0" />
            </Link>
          ) : null}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Gallery
          title={item.title}
          images={item.images.map((image, i) => ({ src: mediaUrl(image.key), width: image.width, height: image.height, alt: image.alt || `${item.title}, foto ${i + 1}` }))}
        />
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-start gap-3">
            <LotTag number={item.lotNumber} className="text-sm" />
            <h1 className="font-display text-4xl leading-[1.05]">{item.title}</h1>
          </div>

          <Suspense fallback={<Skeleton className="h-64" />}>
            <LiveLotSection productId={item.id} slug={auction.slug} lot={item.lotNumber} auctionTimeZone={auction.timezone} />
          </Suspense>

          {item.description ? (
            <div className="flex flex-col gap-2 border-t border-line pt-5">
              <h2 className="font-semibold">Descripción</h2>
              <p className="whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300">{item.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      <AuctionTimes auction={auction} />
    </>
  );
}

/** Live price, bids and the bid form. Reads the session and live data, so it streams in. */
async function LiveLotSection({ productId, slug, lot, auctionTimeZone }: { productId: string; slug: string; lot: number; auctionTimeZone: string }) {
  const user = await getCurrentUser();
  const state = await getLotState(getDb(), productId, user?.id ?? null);
  if (!state) notFound();
  const viewer: Viewer = !user ? "guest" : user.role === "admin" ? "admin" : user.approvalStatus === "approved" ? "approved" : user.approvalStatus;
  return <LiveLot initial={state} viewer={viewer} loginHref={`/entrar?next=${encodeURIComponent(`/subastas/${slug}/${lot}`)}`} auctionTimeZone={auctionTimeZone} />;
}
