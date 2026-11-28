"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

/**
 * Public pages: a friendly message instead of a raw error (e.g. the database is unreachable).
 * In production Next sends only a digest, never the original message, to the browser.
 */
export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error instanceof Error ? error.message : "";
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  const dbUnreachable = process.env.NODE_ENV === "development" && /ECONNREFUSED|Failed query|ETIMEDOUT/.test(message);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-4xl">No pudimos cargar esta página</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Ocurrió un problema temporal. Inténtalo de nuevo en unos segundos.</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => retry()} className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
          Reintentar
        </button>
        <Link href="/" className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
          Ir al inicio
        </Link>
      </div>
      {dbUnreachable ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-left font-mono text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Desarrollo: no hay conexión con la base de datos. ¿Está abierto el túnel? Ejecuta <strong>npm run db:tunnel</strong> (o reinicia <strong>npm run dev</strong>, que lo abre solo).
        </p>
      ) : null}
      {digest ? <p className="text-xs text-zinc-400">Código: {digest}</p> : null}
    </main>
  );
}
