import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, Skeleton } from "@/components/ui";
import { AuditList } from "@/components/audit-list";
import { getAuctionForAdmin } from "@/lib/admin/auctions";
import { auctionAuditLog } from "@/lib/admin/audit";
import { DISPLAY_STATE_LABELS, displayState, permissions, publishProblems } from "@/lib/auctions/rules";
import { formatAuctionTime, instantToWallClock } from "@/lib/time";
import { timeZoneLabel } from "@/lib/timezones";
import { updateAuction } from "../actions";
import { AuctionForm } from "../auction-form";
import { StateBadge } from "../state-badge";
import { ProductsSection } from "./products-section";
import { StatusActions } from "./status-actions";

export const metadata: Metadata = { title: "Editar subasta" };

export default function AuctionAdminPage({ params, searchParams }: PageProps<"/admin/subastas/[id]">) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/subastas" className="text-sm underline">
        ← Subastas
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AuctionAdmin params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AuctionAdmin({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/subastas/[id]">["params"];
  searchParams: PageProps<"/admin/subastas/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await getAuctionForAdmin(id);
  if (!result) notFound();
  const { auction, now } = result;
  const state = displayState(auction, now);
  const can = permissions(auction, now);
  const problems = can.publish ? publishProblems(auction, now) : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{auction.title}</h1>
        <StateBadge state={state} label={DISPLAY_STATE_LABELS[state]} />
      </div>
      {query.creada ? <Notice tone="success">Borrador creado. Ahora agrega los productos y publícala cuando esté lista.</Notice> : null}
      {query["producto-eliminado"] ? <Notice tone="success">Producto eliminado.</Notice> : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800" data-testid="auction-summary">
        <dt className="text-zinc-500">Inicio</dt>
        <dd>{formatAuctionTime(auction.startsAt, auction.timezone)}</dd>
        <dt className="text-zinc-500">Cierre</dt>
        <dd>{formatAuctionTime(auction.endsAt, auction.timezone)}</dd>
        <dt className="text-zinc-500">Zona horaria</dt>
        <dd>{timeZoneLabel(auction.timezone)}</dd>
        <dt className="text-zinc-500">UTC</dt>
        <dd className="font-mono text-xs">
          {auction.startsAt.toISOString()} → {auction.endsAt.toISOString()}
        </dd>
        <dt className="text-zinc-500">Página pública</dt>
        <dd>
          <Link href={`/subastas/${auction.slug}`} className="font-mono text-xs underline">
            /subastas/{auction.slug}
          </Link>
          {state === "draft" ? <span className="ml-2 text-xs text-zinc-500">(vista previa: solo tú la ves)</span> : null}
          {!auction.listed ? <span className="ml-2 text-xs text-zinc-500">(no listada: solo con el enlace)</span> : null}
        </dd>
        {auction.createdByName ? (
          <>
            <dt className="text-zinc-500">Creada por</dt>
            <dd>{auction.createdByName}</dd>
          </>
        ) : null}
      </dl>

      <section aria-labelledby="estado" className="flex flex-col gap-3">
        <h2 id="estado" className="text-lg font-medium">
          Estado
        </h2>
        {state === "cancelled" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Esta subasta fue cancelada.</p>
        ) : state === "ended" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Esta subasta ya terminó.</p>
        ) : null}
        {state === "live" || state === "ended" ? (
          <Link href={`/admin/subastas/${auction.id}/resultados`} className="self-start font-medium underline">
            {state === "ended" ? "Ver resultados" : "Ver resultados parciales"}
          </Link>
        ) : null}
        <StatusActions id={auction.id} can={can} publishProblems={problems} />
      </section>

      <Suspense fallback={<Skeleton className="h-32" />}>
        <ProductsSection auctionId={auction.id} canEditProducts={can.editProducts} />
      </Suspense>

      <section aria-labelledby="datos" className="flex flex-col gap-3">
        <h2 id="datos" className="text-lg font-medium">
          Datos de la subasta
        </h2>
        <AuctionForm
          action={updateAuction}
          id={auction.id}
          submitLabel="Guardar cambios"
          canEditText={can.editText}
          canEditWindow={can.editWindow}
          defaults={{
            title: auction.title,
            description: auction.description,
            timezone: auction.timezone,
            startsAt: instantToWallClock(auction.startsAt, auction.timezone),
            endsAt: instantToWallClock(auction.endsAt, auction.timezone),
            listed: auction.listed ? "on" : "off",
          }}
        />
      </section>

      <section aria-labelledby="historial" className="flex flex-col gap-3">
        <h2 id="historial" className="text-lg font-medium">
          Historial
        </h2>
        <Suspense fallback={<Skeleton className="h-24" />}>
          <AuctionHistory auctionId={auction.id} />
        </Suspense>
      </section>
    </>
  );
}

async function AuctionHistory({ auctionId }: { auctionId: string }) {
  return <AuditList entries={await auctionAuditLog(auctionId)} />;
}
