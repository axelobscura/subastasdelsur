import Link from "next/link";
import { Suspense } from "react";
import { AuctionGrid } from "@/components/auction-card";
import { Skeleton } from "@/components/ui";
import { groupByPhase } from "@/lib/auctions/rules";
import { getPublishedAuctions } from "@/lib/catalog";
import { requestTime } from "@/lib/request-time";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10">
      <section className="flex flex-col gap-4 py-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Subastas del sur</h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Subastas en línea. Puja desde cualquier lugar: cada subasta empieza y termina en el mismo instante para todos, estés donde estés.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/subastas" className="rounded-md bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            Ver subastas
          </Link>
          <Link href="/registro" className="rounded-md border border-zinc-300 px-4 py-2.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
            Registrarme para pujar
          </Link>
        </div>
      </section>

      {/* Which auctions are live depends on the time, so this part renders per request. */}
      <Suspense fallback={<Skeleton className="h-72" />}>
        <CurrentAuctions />
      </Suspense>
    </main>
  );
}

async function CurrentAuctions() {
  const now = await requestTime();
  const { live, upcoming } = groupByPhase(await getPublishedAuctions(), now);
  const serverNow = now.getTime();

  if (!live.length && !upcoming.length) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        No hay subastas en curso ni programadas por ahora. ¡Vuelve pronto!
      </p>
    );
  }
  return (
    <>
      {live.length ? (
        <section aria-labelledby="en-vivo" className="flex flex-col gap-4">
          <h2 id="en-vivo" className="text-2xl font-semibold tracking-tight">
            En vivo
          </h2>
          <AuctionGrid auctions={live.slice(0, 6)} serverNow={serverNow} />
        </section>
      ) : null}
      {upcoming.length ? (
        <section aria-labelledby="proximas" className="flex flex-col gap-4">
          <h2 id="proximas" className="text-2xl font-semibold tracking-tight">
            Próximas subastas
          </h2>
          <AuctionGrid auctions={upcoming.slice(0, 6)} serverNow={serverNow} />
        </section>
      ) : null}
      <Link href="/subastas" className="self-start font-medium underline">
        Ver todas las subastas
      </Link>
    </>
  );
}
