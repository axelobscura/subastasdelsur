import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice, PageCard, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { signOut } from "../entrar/actions";

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

      <form action={signOut}>
        <button type="submit" className="text-sm underline">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
