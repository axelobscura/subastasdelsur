import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-medium text-zinc-500">404</p>
      <h1 className="font-display text-4xl">Página no encontrada</h1>
      <p className="text-zinc-600 dark:text-zinc-400">La página que buscas no existe o no tienes acceso a ella.</p>
      <Link href="/" className="font-medium underline">
        Volver al inicio
      </Link>
    </main>
  );
}
