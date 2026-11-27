import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { DEFAULT_AUCTION_TIMEZONE } from "@/lib/time";
import { timeZoneLabel } from "@/lib/timezones";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Subastas del sur
          </Link>
          <Link href="/subastas" className="hover:underline">
            Subastas
          </Link>
          <div className="ml-auto flex items-center gap-4">
            {/* Reads the session, so it streams in; the rest of the header is static */}
            <Suspense fallback={<GuestLinks />}>
              <UserLinks />
            </Suspense>
          </div>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        <p>
          Los horarios se muestran en la hora de cada subasta (normalmente {timeZoneLabel(DEFAULT_AUCTION_TIMEZONE)}) y en tu hora local. Todas las subastas
          empiezan y terminan en el mismo instante para todos los postores.
        </p>
      </footer>
    </div>
  );
}

function GuestLinks() {
  return (
    <>
      <Link href="/entrar" className="hover:underline">
        Iniciar sesión
      </Link>
      <Link href="/registro" className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
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
        <Link href="/admin" className="hover:underline">
          Administración
        </Link>
      ) : null}
      <Link href="/mi-cuenta" className="hover:underline">
        Mi cuenta
      </Link>
    </>
  );
}
