import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionTimes } from "@/components/auction-times";
import { AuctionClock } from "@/components/clock";
import { Gallery } from "@/components/gallery";
import { Notice, Skeleton } from "@/components/ui";
import { getAuctionBySlug, getCatalogProduct, getNeighbourLots } from "@/lib/catalog";
import { getVisibleAuction } from "@/lib/catalog-access";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { requestTime } from "@/lib/request-time";
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
  const serverNow = (await requestTime()).getTime();

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
            <AuctionClock startsAt={auction.startsAt.getTime()} endsAt={auction.endsAt.getTime()} serverNow={serverNow} status={auction.status} size="lg" />
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" data-testid="lot-prices">
            <div>
              <dt className="text-sm text-zinc-500">Precio de salida</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatMoney(item.startingPriceCents)}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Incremento mínimo</dt>
              <dd className="text-2xl font-semibold tabular-nums">{formatMoney(item.minIncrementCents)}</dd>
            </div>
          </dl>

          <Suspense fallback={<Skeleton className="h-24" />}>
            <BidArea slug={auction.slug} lot={item.lotNumber} />
          </Suspense>

          {item.description ? <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{item.description}</p> : null}
        </div>
      </div>

      <AuctionTimes auction={auction} />
    </>
  );
}

/** Who may bid. The bid form itself comes with phase 5. */
async function BidArea({ slug, lot }: { slug: string; lot: number }) {
  const user = await getCurrentUser();
  const here = `/subastas/${slug}/${lot}`;
  if (!user) {
    return (
      <Notice title="¿Quieres pujar?">
        <Link href={`/entrar?next=${encodeURIComponent(here)}`} className="font-medium underline">
          Inicia sesión
        </Link>{" "}
        o{" "}
        <Link href="/registro" className="font-medium underline">
          regístrate como postor
        </Link>
        . Nuestro equipo valida cada cuenta antes de habilitar las pujas.
      </Notice>
    );
  }
  if (user.role === "admin") return <Notice>Estás viendo la página como administrador.</Notice>;
  if (user.approvalStatus === "pending") return <Notice tone="warning" title="Tu cuenta está en revisión">Podrás pujar en cuanto nuestro equipo apruebe tu cuenta. Te avisaremos por correo.</Notice>;
  if (user.approvalStatus === "rejected") return <Notice tone="danger">Tu cuenta no fue aprobada para pujar.</Notice>;
  return <Notice tone="success" title="Tu cuenta está aprobada">Muy pronto podrás pujar en línea desde aquí.</Notice>;
}
