import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, Skeleton } from "@/components/ui";
import { getAuctionForAdmin } from "@/lib/admin/auctions";
import { lotNumbersInUse } from "@/lib/admin/products";
import { permissions } from "@/lib/auctions/rules";
import { CURRENCY } from "@/lib/money";
import { nextLotNumber } from "@/lib/products/rules";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewProductPage({ params }: PageProps<"/admin/subastas/[id]/productos/nuevo">) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewProduct params={params} />
      </Suspense>
    </div>
  );
}

async function NewProduct({ params }: { params: PageProps<"/admin/subastas/[id]/productos/nuevo">["params"] }) {
  const { id } = await params;
  const [result, lots] = await Promise.all([getAuctionForAdmin(id), lotNumbersInUse(id)]);
  if (!result) notFound();
  const can = permissions(result.auction, result.now);
  return (
    <>
      <Link href={`/admin/subastas/${id}`} className="text-sm underline">
        ← {result.auction.title}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
      {can.editProducts ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Después de guardarlo podrás subir sus fotos.</p>
          <ProductForm
            action={createProduct}
            auctionId={id}
            submitLabel="Crear producto"
            canEditPricing
            canEditContent
            currency={CURRENCY}
            defaults={{ lotNumber: String(nextLotNumber(lots)), title: "", description: "", startingPrice: "", minIncrement: "", reservePrice: "" }}
          />
        </>
      ) : (
        <Notice tone="warning">La subasta ya empezó o está cancelada: ya no se pueden agregar productos.</Notice>
      )}
    </>
  );
}
