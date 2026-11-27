import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionTimes } from "@/components/auction-times";
import { Gallery } from "@/components/gallery";
import { LiveLot, type Viewer } from "@/components/live-lot";
import { Notice, Skeleton } from "@/components/ui";
import { getAuctionBySlug, getCatalogProduct, getNeighbourLots } from "@/lib/catalog";
import { getVisibleAuction } from "@/lib/catalog-access";
import { getLotState } from "@/lib/bids-db";
import { getCurrentUser } from "@/lib/dal";
import { getDb } from "@/lib/db";
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
  return found ? { title: `Lote ${found.lotNumber}: ${found.title} · ${auction.title}` } : {};
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
        <Link href={`/subastas/${auction.slug}`} className="underline">
          ← {auction.title}
        </Link>
        <span className="flex gap-4">
          {neighbours.previous !== null ? (
            <Link href={`/subastas/${auction.slug}/${neighbours.previous}`} className="underline">
              ← Lote {neighbours.previous}
            </Link>
          ) : null}
          {neighbours.next !== null ? (
            <Link href={`/subastas/${auction.slug}/${neighbours.next}`} className="underline">
              Lote {neighbours.next} →
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
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">Lote {item.lotNumber}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{item.title}</h1>
          </div>

          <Suspense fallback={<Skeleton className="h-64" />}>
            <LiveLotSection productId={item.id} slug={auction.slug} lot={item.lotNumber} auctionTimeZone={auction.timezone} />
          </Suspense>

          {item.description ? <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{item.description}</p> : null}
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
