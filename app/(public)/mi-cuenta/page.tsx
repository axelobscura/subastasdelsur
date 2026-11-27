import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice, PageCard, Skeleton } from "@/components/ui";
import { MY_LOT_STATUS_LABELS, type MyLotStatus } from "@/lib/bids";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { getMyLots } from "@/lib/my-bids";
import { formatAuctionTimeShort } from "@/lib/time";
import { signOut } from "@/lib/sign-out";

export const metadata: Metadata = { title: "Mi cuenta" };

export default function AccountPage() {
  return (
    <PageCard title="Mi cuenta">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <Account />
      </Suspense>
    </PageCard>
  );
}

async function Account() {
  const user = await requireUser("/mi-cuenta");
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">Nombre</dt>
        <dd>{user.name}</dd>
        <dt className="text-zinc-500">Correo</dt>
        <dd>{user.email}</dd>
      </dl>

      {user.role === "admin" ? (
        <Link href="/admin" className="font-medium underline">
          Ir al panel de administración
        </Link>
      ) : user.approvalStatus === "approved" ? (
        <Notice tone="success" title="Cuenta aprobada">
          Ya puedes participar y pujar en las subastas.
        </Notice>
      ) : user.approvalStatus === "rejected" ? (
        <Notice tone="danger" title="Tu cuenta no fue aprobada">
          Si crees que se trata de un error, escríbenos a{" "}
          <a className="underline" href="mailto:admin@subastasdelsur.io">
            admin@subastasdelsur.io
          </a>
          .
        </Notice>
      ) : (
        <Notice tone="warning" title="Tu cuenta está en revisión">
          Nuestro equipo está validando tu acceso. Te avisaremos por correo en cuanto tu cuenta sea aprobada. Mientras tanto no podrás pujar.
        </Notice>
      )}

      {user.role === "bidder" ? (
        <Suspense fallback={<Skeleton className="h-24" />}>
          <MyBids userId={user.id} />
        </Suspense>
      ) : null}

      <form action={signOut}>
        <button type="submit" className="text-sm underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

const STATUS_STYLE: Record<MyLotStatus, string> = {
  leading: "text-emerald-800 dark:text-emerald-300",
  won: "text-emerald-800 dark:text-emerald-300",
  outbid: "text-amber-800 dark:text-amber-300",
  reserve_not_met: "text-zinc-600 dark:text-zinc-400",
  lost: "text-zinc-600 dark:text-zinc-400",
  cancelled: "text-red-700 dark:text-red-400",
};

async function MyBids({ userId }: { userId: string }) {
  const lots = await getMyLots(userId);
  return (
    <section aria-labelledby="mis-pujas" className="flex flex-col gap-2">
      <h2 id="mis-pujas" className="text-lg font-medium">
        Mis pujas
      </h2>
      {lots.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no has pujado. <Link href="/subastas" className="underline">Ver subastas</Link>
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800" data-testid="my-bids">
          {lots.map((lot) => (
            <li key={lot.productId} className="flex flex-col gap-0.5 px-3 py-2">
              <Link href={`/subastas/${lot.auctionSlug}/${lot.lotNumber}`} className="font-medium underline">
                Lote {lot.lotNumber}: {lot.productTitle}
              </Link>
              <span className="text-zinc-500">
                {lot.auctionTitle} · cierra {formatAuctionTimeShort(lot.endsAt, lot.timezone)}
              </span>
              <span>
                Tu puja más alta {formatMoney(lot.myHighestCents)}
                {lot.currentPriceCents !== null ? ` · actual ${formatMoney(lot.currentPriceCents)}` : ""} ·{" "}
                <strong className={STATUS_STYLE[lot.status]}>{MY_LOT_STATUS_LABELS[lot.status]}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
