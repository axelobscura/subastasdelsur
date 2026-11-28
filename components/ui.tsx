import type { ReactNode } from "react";

export function PageCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display mb-6 text-3xl">{title}</h1>
        {children}
      </div>
      {footer ? <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">{footer}</div> : null}
    </main>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children: ReactNode }) {
  const styles = {
    info: "border-line bg-surface",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
    danger: "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm leading-relaxed ${styles}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-900 ${className}`} />;
}

/** The yellow lot tag, like the paper tags stuck on items in an auction yard. */
export function LotTag({ number, className = "" }: { number: number; className?: string }) {
  return <span className={`inline-flex rounded-md bg-signal px-2 py-1 text-xs font-bold text-board shadow-sm ${className}`}>Lote {number}</span>;
}

