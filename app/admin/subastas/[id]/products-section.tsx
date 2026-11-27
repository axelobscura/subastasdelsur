import Image from "next/image";
import Link from "next/link";
import { listProducts } from "@/lib/admin/products";
import { formatMoney } from "@/lib/money";
import { mediaUrl } from "@/lib/storage";

export async function ProductsSection({ auctionId, canEditProducts }: { auctionId: string; canEditProducts: boolean }) {
  const products = await listProducts(auctionId);
  return (
    <section aria-labelledby="productos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="productos" className="text-lg font-medium">
          Productos ({products.length})
        </h2>
        {canEditProducts ? (
          <Link href={`/admin/subastas/${auctionId}/productos/nuevo`} className="text-sm font-medium underline">
            Agregar producto
          </Link>
        ) : null}
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Todavía no hay productos. Agrega al menos uno, con fotos, para poder publicar.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/subastas/${auctionId}/productos/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                  {p.coverKey ? <Image src={mediaUrl(p.coverKey)} alt="" fill sizes="64px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    Lote {p.lotNumber}: {p.title}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Salida {formatMoney(p.startingPriceCents)} · incremento {formatMoney(p.minIncrementCents)}
                    {p.reservePriceCents != null ? ` · reserva ${formatMoney(p.reservePriceCents)}` : ""}
                  </p>
                </div>
                <span className={`text-sm whitespace-nowrap ${p.imageCount ? "text-zinc-600 dark:text-zinc-400" : "font-medium text-amber-700 dark:text-amber-400"}`}>
                  {p.imageCount ? `${p.imageCount} foto${p.imageCount === 1 ? "" : "s"}` : "Sin fotos"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
