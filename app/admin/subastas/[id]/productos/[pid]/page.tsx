import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, Skeleton } from "@/components/ui";
import { getAuctionForAdmin } from "@/lib/admin/auctions";
import { getProductForAdmin } from "@/lib/admin/products";
import { permissions } from "@/lib/auctions/rules";
import { CURRENCY, centsToInput } from "@/lib/money";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/products/rules";
import { mediaUrl } from "@/lib/storage";
import { updateProduct } from "../actions";
import { ProductForm } from "../product-form";
import { DeleteProduct } from "./delete-product";
import { ImageControls } from "./image-controls";
import { PhotoUploader } from "./photo-uploader";

export const metadata: Metadata = { title: "Editar producto" };

type Props = PageProps<"/admin/subastas/[id]/productos/[pid]">;

export default function ProductAdminPage({ params, searchParams }: Props) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProductAdmin params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductAdmin({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const [{ id, pid }, { creado }] = await Promise.all([params, searchParams]);
  const [auctionResult, productResult] = await Promise.all([getAuctionForAdmin(id), getProductForAdmin(id, pid)]);
  if (!auctionResult || !productResult) notFound();
  const { auction, now } = auctionResult;
  const { product, images } = productResult;
  const can = permissions(auction, now);

  return (
    <>
      <Link href={`/admin/subastas/${id}`} className="text-sm underline">
        ← {auction.title}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        Lote {product.lotNumber}: {product.title}
      </h1>
      {creado ? <Notice tone="success">Producto creado. Ahora sube sus fotos: la primera es la portada.</Notice> : null}

      <section aria-labelledby="fotos" className="flex flex-col gap-4">
        <h2 id="fotos" className="text-lg font-medium">
          Fotos ({images.length}/{MAX_IMAGES_PER_PRODUCT})
        </h2>
        {images.length === 0 ? <Notice tone="warning">Este producto todavía no tiene fotos. Necesita al menos una para publicar la subasta.</Notice> : null}
        {images.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="photo-grid">
            {images.map((image, index) => (
              <li key={image.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                  <Image
                    src={mediaUrl(image.storageKey)}
                    alt={image.alt || `Foto ${index + 1} de ${product.title}`}
                    fill
                    sizes="(min-width: 1024px) 220px, 45vw"
                    className="object-contain"
                  />
                  {index === 0 ? <span className="absolute top-1 left-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-xs text-white">Portada</span> : null}
                </div>
                <p className="text-xs text-zinc-500">
                  {image.width}×{image.height}
                </p>
                {can.editProductContent ? (
                  <ImageControls auctionId={id} productId={pid} imageId={image.id} isFirst={index === 0} isLast={index === images.length - 1} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {can.editProductContent ? <PhotoUploader auctionId={id} productId={pid} remaining={MAX_IMAGES_PER_PRODUCT - images.length} /> : null}
      </section>

      <section aria-labelledby="datos" className="flex flex-col gap-3">
        <h2 id="datos" className="text-lg font-medium">
          Datos del producto
        </h2>
        <ProductForm
          action={updateProduct}
          auctionId={id}
          productId={pid}
          submitLabel="Guardar producto"
          canEditPricing={can.editProducts}
          canEditContent={can.editProductContent}
          currency={CURRENCY}
          defaults={{
            lotNumber: String(product.lotNumber),
            title: product.title,
            description: product.description,
            startingPrice: centsToInput(product.startingPriceCents),
            minIncrement: centsToInput(product.minIncrementCents),
            reservePrice: centsToInput(product.reservePriceCents),
          }}
        />
      </section>

      {can.editProducts ? <DeleteProduct auctionId={id} productId={pid} /> : null}
    </>
  );
}
