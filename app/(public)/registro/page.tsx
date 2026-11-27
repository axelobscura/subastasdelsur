import type { Metadata } from "next";
import Link from "next/link";
import { PageCard } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <PageCard
      title="Crear cuenta de postor"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="font-medium underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <RegisterForm />
    </PageCard>
  );
}
