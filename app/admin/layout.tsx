import Link from "next/link";
import { Suspense } from "react";
import { ghostButtonClass, NavLink, pillClass, pillTrayClass } from "@/components/nav-link";
import { SiteLogo } from "@/components/site-logo";
import { Skeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/dal";
import { signOut } from "@/lib/sign-out";

// The gate here is for UX only. Every admin page and action checks requireAdmin() itself,
// because layouts don't re-render on client-side navigation.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <nav aria-label="Administración" className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-2.5 sm:flex-nowrap">
          <Link href="/admin" aria-label="Subastas del Sur Admin" className="flex shrink-0 items-center gap-2 rounded-md">
            <SiteLogo className="h-9 w-auto" />
            <span className="rounded bg-board px-1.5 py-0.5 text-xs font-semibold text-white dark:bg-brand dark:text-board" aria-hidden>
              Admin
            </span>
          </Link>
          <div className={`${pillTrayClass} order-last w-full sm:order-none sm:w-auto`}>
            <NavLink href="/admin/postores" match="/admin/postores" className={`${pillClass} flex-1 text-center sm:flex-none`}>
              Postores
            </NavLink>
            <NavLink href="/admin/subastas" match="/admin/subastas" className={`${pillClass} flex-1 text-center sm:flex-none`}>
              Subastas
            </NavLink>
            <NavLink href="/admin/actividad" match="/admin/actividad" className={`${pillClass} flex-1 text-center sm:flex-none`}>
              Actividad
            </NavLink>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className={ghostButtonClass}>
              Ver sitio
            </Link>
            <form action={signOut}>
              <button type="submit" className={ghostButtonClass}>
                Cerrar sesión
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
