import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, Skeleton } from "@/components/ui";
import { getBidder } from "@/lib/admin/bidders";
import { DEFAULT_AUCTION_TIMEZONE, formatAuctionTime } from "@/lib/time";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Revisar postor" };

const STATUS = {
  pending: { label: "Pendiente de aprobación", tone: "warning" },
  approved: { label: "Aprobado", tone: "success" },
  rejected: { label: "Rechazado", tone: "danger" },
} as const;

export default function BidderPage({ params }: PageProps<"/admin/postores/[id]">) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/admin/postores" className="text-sm underline">
        ← Postores
      </Link>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Bidder params={params} />
      </Suspense>
    </div>
  );
}

async function Bidder({ params }: { params: PageProps<"/admin/postores/[id]">["params"] }) {
  const { id } = await params;
  const bidder = await getBidder(id);
  if (!bidder) notFound();
  const tz = DEFAULT_AUCTION_TIMEZONE;
  const status = STATUS[bidder.approvalStatus];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{bidder.name}</h1>
      <Notice tone={bidder.emailVerified ? status.tone : "info"} title={bidder.emailVerified ? status.label : "Correo sin confirmar"}>
        {bidder.reviewedAt ? (
          <>
            Revisado el {formatAuctionTime(bidder.reviewedAt, tz)}
            {bidder.reviewerName ? ` por ${bidder.reviewerName}` : ""}.{bidder.reviewNote ? ` Nota: ${bidder.reviewNote}` : ""}
          </>
        ) : bidder.emailVerified ? (
          "Confirmó su correo y espera tu revisión."
        ) : (
          "Todavía no abre el enlace de confirmación que le enviamos."
        )}
      </Notice>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <dt className="text-zinc-500">Correo</dt>
        <dd>
          <a href={`mailto:${bidder.email}`} className="underline">
            {bidder.email}
          </a>
        </dd>
        <dt className="text-zinc-500">Teléfono</dt>
        <dd>
          <a href={`tel:${bidder.phone.replace(/[^\d+]/g, "")}`} className="underline">
            {bidder.phone}
          </a>
        </dd>
        <dt className="text-zinc-500">Registro</dt>
        <dd>{formatAuctionTime(bidder.createdAt, tz)}</dd>
      </dl>
      <ReviewForm id={bidder.id} status={bidder.approvalStatus} emailVerified={bidder.emailVerified} />
    </>
  );
}
