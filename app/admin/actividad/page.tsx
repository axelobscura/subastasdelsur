import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditList } from "@/components/audit-list";
import { Skeleton } from "@/components/ui";
import { listAuditLog } from "@/lib/admin/audit";

export const metadata: Metadata = { title: "Actividad" };

export default function ActivityPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Los últimos cambios hechos desde la administración: subastas, lotes, fotos y postores.</p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Activity />
      </Suspense>
    </div>
  );
}

async function Activity() {
  return <AuditList entries={await listAuditLog()} />;
}
