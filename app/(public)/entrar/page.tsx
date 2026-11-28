import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout, AuthPoint } from "@/components/auth-layout";
import { IconBell, IconGavel, IconTimer } from "@/components/icons";
import { Skeleton } from "@/components/ui";
import retroexcavadora from "@/public/auth/retroexcavadora.webp";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage() {
  return (
    <AuthLayout
      title="Iniciar sesión"
      intro="Entra para pujar y seguir tus lotes en vivo."
      photo={retroexcavadora}
      photoAlt="Retroexcavadora amarilla estacionada en una calle"
      photoPosition="object-[50%_78%]"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-brand hover:underline">
            Regístrate como postor
          </Link>
        </>
      }
      aside={
        <>
          <h2 className="font-display text-4xl leading-tight">Tus pujas, al momento</h2>
          <ul className="flex flex-col gap-5">
            <AuthPoint icon={IconGavel} title="Puja desde cualquier lugar">
              En tu celular o tu computadora, mientras la subasta está abierta.
            </AuthPoint>
            <AuthPoint icon={IconBell} title="Te avisamos si te superan">
              Recibes un correo cuando alguien puja más que tú.
            </AuthPoint>
            <AuthPoint icon={IconTimer} title="El mismo cierre para todos">
              Cada subasta termina en el mismo instante, estés donde estés.
            </AuthPoint>
          </ul>
        </>
      }
    >
      {/* The form reads ?next= from the URL */}
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SignInForm />
      </Suspense>
    </AuthLayout>
  );
}
