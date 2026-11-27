import type { Metadata } from "next";
import Link from "next/link";
import { PageCard } from "@/components/ui";
import { RequestResetForm } from "./forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RequestResetPage() {
  return (
    <PageCard
      title="Recuperar contraseña"
      footer={
        <Link href="/entrar" className="underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.</p>
      <RequestResetForm />
    </PageCard>
  );
}
