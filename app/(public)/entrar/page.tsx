import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageCard, Skeleton } from "@/components/ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage() {
  return (
    <PageCard
      title="Iniciar sesión"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium underline">
            Regístrate como postor
          </Link>
        </>
      }
    >
      {/* The form reads ?next= from the URL */}
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SignInForm />
      </Suspense>
    </PageCard>
  );
}
