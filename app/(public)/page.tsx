import Link from "next/link";
import { Suspense } from "react";
import { AuctionGrid } from "@/components/auction-card";
import { CountdownBoard } from "@/components/countdown-board";
import { IconChevronRight, IconGavel, IconShieldCheck, IconTrophy, IconUserPlus } from "@/components/icons";
import { Skeleton } from "@/components/ui";
import { groupByPhase } from "@/lib/auctions/rules";
import { getPublishedAuctions, type CatalogAuction } from "@/lib/catalog";
import { requestTime } from "@/lib/request-time";
import { formatAuctionTimeShort } from "@/lib/time";

export default function Home() {
  return (
    <main className="flex flex-col">
      <section className="bg-board text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
          <div className="flex flex-col gap-5">
            <h1 className="font-display text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">Subastas en línea de vehículos, maquinaria y equipo</h1>
            <p className="max-w-xl text-lg leading-relaxed text-zinc-300">
              Puja desde tu celular o tu computadora. Cada subasta abre y cierra en el mismo instante para todos los postores, estés donde estés.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/subastas" className="btn-signal font-nav inline-flex items-center gap-2 rounded-lg px-6 py-3 text-lg transition hover:brightness-105 active:translate-y-px">
                <IconGavel aria-hidden className="size-5 shrink-0" />
                Ver subastas
              </Link>
              <Link
                href="/registro"
                className="font-nav inline-flex items-center gap-2 rounded-lg border border-white/30 bg-gradient-to-b from-white/10 to-white/0 px-6 py-3 text-lg text-white transition hover:border-white/50 hover:from-white/15"
              >
                <IconUserPlus aria-hidden className="size-5 shrink-0" />
                Crear cuenta para pujar
              </Link>
            </div>
          </div>
          {/* Which auction is featured depends on the time, so this part renders per request. */}
          <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl border border-board-line bg-white/[0.03]" />}>
            <FeaturedAuction />
          </Suspense>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 pt-12">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <CurrentAuctions />
        </Suspense>
        <HowItWorks />
      </div>
    </main>
  );
}

async function FeaturedAuction() {
  const now = await requestTime();
  const { live, upcoming } = groupByPhase(await getPublishedAuctions(), now);
  const featured: CatalogAuction | undefined = live[0] ?? upcoming[0];

  if (!featured) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-board-line p-6 sm:p-8">
        <h2 className="font-display text-3xl">Próximamente, nuevas subastas</h2>
        <p className="text-zinc-300">
          Crea tu cuenta ahora: revisamos cada registro antes de habilitar las pujas, así estarás listo cuando abra la siguiente.
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/subastas/${featured.slug}`}
      className="group flex flex-col gap-6 rounded-2xl border border-board-line bg-white/[0.02] p-5 hover:border-zinc-500 sm:p-7"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-3xl leading-tight group-hover:underline sm:text-4xl">{featured.title}</h2>
        <p className="text-sm text-zinc-400">
          {featured.productCount} {featured.productCount === 1 ? "lote" : "lotes"}. Cierra el {formatAuctionTimeShort(featured.endsAt, featured.timezone)}
        </p>
      </div>
      <CountdownBoard startsAt={featured.startsAt.getTime()} endsAt={featured.endsAt.getTime()} serverNow={now.getTime()} />
      <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-white px-4 py-2 text-sm font-semibold text-board group-hover:bg-zinc-100">
        Ver los lotes
        <IconChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

async function CurrentAuctions() {
  const now = await requestTime();
  const { live, upcoming } = groupByPhase(await getPublishedAuctions(), now);
  const serverNow = now.getTime();

  if (!live.length && !upcoming.length) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-surface p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        No hay subastas en curso ni programadas por ahora. Las nuevas aparecerán aquí.
      </p>
    );
  }
  return (
    <>
      {live.length ? (
        <section aria-labelledby="en-vivo" className="flex flex-col gap-5">
          <SectionHeading id="en-vivo" title="En vivo ahora" href="/subastas?estado=en-vivo" />
          <AuctionGrid auctions={live.slice(0, 6)} serverNow={serverNow} />
        </section>
      ) : null}
      {upcoming.length ? (
        <section aria-labelledby="proximas" className="flex flex-col gap-5">
          <SectionHeading id="proximas" title="Próximas subastas" href="/subastas?estado=proximas" />
          <AuctionGrid auctions={upcoming.slice(0, 6)} serverNow={serverNow} />
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({ id, title, href }: { id: string; title: string; href: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
      <h2 id={id} className="font-display text-3xl sm:text-4xl">
        {title}
      </h2>
      <Link href={href} className="shrink-0 text-sm font-semibold text-brand hover:underline">
        Ver todas
      </Link>
    </div>
  );
}

const STEPS = [
  { icon: IconUserPlus, title: "Crea tu cuenta", body: "Regístrate con tu nombre, correo y teléfono, y confirma tu correo." },
  { icon: IconShieldCheck, title: "Validamos tus datos", body: "Nuestro equipo revisa cada registro. Te avisamos por correo cuando tu cuenta esté aprobada." },
  { icon: IconGavel, title: "Puja en vivo", body: "Mientras la subasta está abierta, ofrece al menos la puja mínima. Si alguien te supera, te avisamos." },
  { icon: IconTrophy, title: "Gana el lote", body: "Al cierre, la puja más alta que alcance el precio de reserva gana. Te contactamos con los siguientes pasos." },
];

function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="flex scroll-mt-24 flex-col gap-6">
      <h2 id="como-funciona-titulo" className="font-display border-b border-line pb-3 text-3xl sm:text-4xl">
        Cómo funciona
      </h2>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-2">
            <span className="relative mb-1 flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
              <step.icon className="size-6" />
              <span className="font-display absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-signal text-xs text-board">{i + 1}</span>
            </span>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
