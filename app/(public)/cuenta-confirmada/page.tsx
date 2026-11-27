import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice, PageCard, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Correo confirmado" };

// The email verification link (/api/auth/verify-email) redirects here, signed in on success,
// or with ?error=… if the token is invalid or expired.
export default function EmailConfirmedPage({ searchParams }: PageProps<"/cuenta-confirmada">) {
  return (
    <PageCard title="Confirmación de correo">
      <Suspense fallback={<Skeleton className="h-32" />}>
        <Result searchParams={searchParams} />
      </Suspense>
    </PageCard>
  );
}

async function Result({ searchParams }: { searchParams: PageProps<"/cuenta-confirmada">["searchParams"] }) {
  const { error } = await searchParams;
  if (error) {
    return (
      <Notice tone="danger" title="El enlace no es válido o ya expiró">
        <p>
          <Link href="/entrar" className="underline">
            Inicia sesión
          </Link>{" "}
          con tu correo y contraseña y te enviaremos un enlace nuevo.
        </p>
      </Notice>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="success" title="¡Tu correo está confirmado!">
        Nuestro equipo está validando tu acceso. Te avisaremos por correo en cuanto tu cuenta sea aprobada. Mientras tanto puedes explorar las subastas, pero todavía no podrás pujar.
      </Notice>
      <Link href="/mi-cuenta" className="text-center font-medium underline">
        Ir a mi cuenta
      </Link>
    </div>
  );
}
