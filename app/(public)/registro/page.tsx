import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout, AuthPoint } from "@/components/auth-layout";
import { IconGavel, IconMailCheck, IconShieldCheck, IconUserPlus } from "@/components/icons";
import camioneta from "@/public/auth/camioneta.webp";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Crear cuenta de postor"
      intro="Regístrate gratis para pujar por vehículos, maquinaria y equipo."
      photo={camioneta}
      photoAlt="Camioneta pick-up blanca de doble cabina"
      photoPosition="object-[30%_65%]"
      wide
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="font-semibold text-brand hover:underline">
            Inicia sesión
          </Link>
        </>
      }
      aside={
        <>
          <h2 className="font-display text-4xl leading-tight">De tu registro a tu primera puja</h2>
          <ol className="flex flex-col gap-5">
            <AuthPoint step={1} icon={IconUserPlus} title="Crea tu cuenta">
              Con tu nombre, correo y teléfono.
            </AuthPoint>
            <AuthPoint step={2} icon={IconMailCheck} title="Confirma tu correo">
              Te enviamos un enlace que vale 24 horas.
            </AuthPoint>
            <AuthPoint step={3} icon={IconShieldCheck} title="Validamos tus datos">
              Nuestro equipo revisa tu registro y te avisa por correo.
            </AuthPoint>
            <AuthPoint step={4} icon={IconGavel} title="Puja en vivo">
              Ya aprobado, puja en cualquier subasta abierta.
            </AuthPoint>
          </ol>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
