import Link from "next/link";
import { Suspense } from "react";
import { IconDashboard, IconGavel, IconLaptop, IconMail, IconPackage, IconPhone, IconSignIn, IconSteps, IconTruck, IconUser, IconUserPlus, IconForklift } from "@/components/icons";
import { ghostButtonClass, NavLink, pillClass, pillTrayClass, primaryButtonClass } from "@/components/nav-link";
import { SiteLogo } from "@/components/site-logo";
import { getCurrentUser } from "@/lib/dal";
import { CATEGORIES, CONTACT } from "@/lib/site";
import { DEFAULT_AUCTION_TIMEZONE } from "@/lib/time";
import { timeZoneLabel } from "@/lib/timezones";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        {/* Phones: logo and account buttons on one row, the section pills on a second row. */}
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-2.5 px-4 py-2.5 md:flex-nowrap md:gap-x-3 md:py-3">
          <Link href="/" aria-label="Subastas del Sur, inicio" className="shrink-0 rounded-md md:mr-3">
            <SiteLogo className="h-10 w-auto sm:h-13 lg:h-14" />
          </Link>
          <div className={`${pillTrayClass} order-last w-full md:order-none md:w-auto`}>
            <NavLink href="/subastas" match="/subastas" className={`${pillClass} flex-1 text-center md:flex-none`}>
              <IconGavel aria-hidden className="size-4 shrink-0" />
              Subastas
            </NavLink>
            <NavLink href="/#como-funciona" className={`${pillClass} flex-1 text-center md:flex-none`}>
              <IconSteps aria-hidden className="size-4 shrink-0" />
              Cómo funciona
            </NavLink>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            {/* Reads the session, so it streams in; the rest of the header is static */}
            <Suspense fallback={<GuestLinks />}>
              <UserLinks />
            </Suspense>
          </div>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}

function GuestLinks() {
  return (
    <>
      <NavLink href="/entrar" match="/entrar" className={ghostButtonClass}>
        <IconSignIn aria-hidden className="size-4 shrink-0" />
        <span className="sm:hidden">Entrar</span>
        <span className="hidden sm:inline">Iniciar sesión</span>
      </NavLink>
      <Link href="/registro" className={primaryButtonClass}>
        <IconUserPlus aria-hidden className="hidden size-4 shrink-0 sm:block" />
        Registrarme
      </Link>
    </>
  );
}

async function UserLinks() {
  const user = await getCurrentUser();
  if (!user) return <GuestLinks />;
  return (
    <>
      {user.role === "admin" ? (
        <NavLink href="/admin" match="/admin" className={ghostButtonClass}>
          <IconDashboard aria-hidden className="size-4 shrink-0" />
          Administración
        </NavLink>
      ) : null}
      <NavLink href="/mi-cuenta" match="/mi-cuenta" className={ghostButtonClass}>
        <IconUser aria-hidden className="size-4 shrink-0" />
        Mi cuenta
      </NavLink>
    </>
  );
}

const CATEGORY_ICONS: Record<(typeof CATEGORIES)[number], typeof IconTruck> = {
  Vehículos: IconTruck,
  "Maquinaria y equipo": IconForklift,
  "Equipo electrónico": IconLaptop,
  "Materiales diversos": IconPackage,
};

function SiteFooter() {
  return (
    <footer className="mt-16 bg-board text-zinc-300">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <SiteLogo tone="dark" className="h-12 w-auto self-start" />
          <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
            Los horarios se muestran en la hora de cada subasta, normalmente {timeZoneLabel(DEFAULT_AUCTION_TIMEZONE)}, y en tu hora local. Todas las subastas empiezan y terminan en el mismo
            instante para todos los postores.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <h2 className="font-semibold text-white">Qué subastamos</h2>
          <ul className="flex flex-col gap-1.5 text-zinc-400">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c];
              return (
                <li key={c} className="flex items-center gap-2">
                  <Icon aria-hidden className="size-4 shrink-0 text-zinc-500" />
                  {c}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <h2 className="font-semibold text-white">Contacto</h2>
          <ul className="flex flex-col gap-1.5">
            <li>
              <a href={CONTACT.phoneHref} className="inline-flex items-center gap-2 hover:text-white hover:underline">
                <IconPhone aria-hidden className="size-4 shrink-0 text-zinc-500" />
                {CONTACT.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT.email}`} className="inline-flex items-center gap-2 hover:text-white hover:underline">
                <IconMail aria-hidden className="size-4 shrink-0 text-zinc-500" />
                {CONTACT.email}
              </a>
            </li>
          </ul>
          <Link href="/registro" className="mt-2 self-start font-medium text-signal hover:underline">
            Crear cuenta para pujar
          </Link>
        </div>
      </div>
      <div className="border-t border-board-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-zinc-400">Subastas del Sur. Subastas en línea en México.</p>
      </div>
    </footer>
  );
}
