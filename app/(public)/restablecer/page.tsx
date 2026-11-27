import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Notice, PageCard, Skeleton } from "@/components/ui";
import { ResetPasswordForm } from "../recuperar/forms";

export const metadata: Metadata = { title: "Nueva contraseña" };

// Better Auth redirects here from the email link with ?token=… (or ?error=INVALID_TOKEN).
export default function ResetPasswordPage({ searchParams }: PageProps<"/restablecer">) {
  return (
    <PageCard title="Elige una nueva contraseña">
      <Suspense fallback={<Skeleton className="h-48" />}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </PageCard>
  );
}

async function ResetContent({ searchParams }: { searchParams: PageProps<"/restablecer">["searchParams"] }) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string" || !token) {
    return (
      <Notice tone="danger" title="El enlace no es válido o ya expiró">
        <Link href="/recuperar" className="underline">
          Solicita un enlace nuevo
        </Link>
        .
      </Notice>
    );
  }
  return <ResetPasswordForm token={token} />;
}
