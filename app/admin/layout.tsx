import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { requireAdmin } from "@/lib/dal";
import { signOut } from "../entrar/actions";

// The gate here is for UX only. Every admin page and action checks requireAdmin() itself,
// because layouts don't re-render on client-side navigation.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
          <Link href="/admin" className="font-semibold">
            Subastas del sur · Admin
          </Link>
          <Link href="/admin/postores" className="hover:underline">
            Postores
          </Link>
          <Link href="/admin/subastas" className="hover:underline">
            Subastas
          </Link>
          <form action={signOut} className="ml-auto">
            <button type="submit" className="hover:underline">
              Cerrar sesión
            </button>
          </form>
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
