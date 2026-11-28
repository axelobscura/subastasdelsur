import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ActiveLink } from "./nav-link-active";

/** The tray that holds the section pills. */
export const pillTrayClass = "flex items-center gap-1 rounded-full border border-line bg-zinc-100/80 p-1 dark:bg-zinc-900/70";

/** A section link inside the tray; the current one is a raised pill. */
export const pillClass =
  "font-nav inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.95rem] text-zinc-600 transition-colors hover:bg-surface hover:text-foreground sm:px-4 sm:text-base dark:text-zinc-300 dark:hover:bg-zinc-800 " +
  "aria-[current=page]:bg-surface aria-[current=page]:text-brand-strong aria-[current=page]:shadow-[0_1px_2px_rgb(14_27_51/0.14),0_0_0_1px_var(--line)] " +
  "dark:aria-[current=page]:bg-brand-soft dark:aria-[current=page]:text-brand-strong";

/** Secondary header actions (Iniciar sesión, Mi cuenta…): outlined, same size as the gradient button. */
export const ghostButtonClass =
  "font-nav inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-gradient-to-b from-surface to-zinc-50 px-3 py-2 text-[0.95rem] text-zinc-800 shadow-[0_1px_2px_rgb(14_27_51/0.08)] transition hover:border-brand/50 hover:text-brand-strong active:translate-y-px sm:px-4 sm:py-2.5 sm:text-[1.05rem] " +
  "dark:from-zinc-900 dark:to-zinc-950 dark:text-zinc-200 aria-[current=page]:border-brand/50 aria-[current=page]:text-brand-strong";

/** The main header action (Registrarme): navy gradient. */
export const primaryButtonClass =
  "btn-brand font-nav inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-brand-strong/40 px-3 py-2 text-[0.95rem] transition hover:brightness-110 active:translate-y-px sm:px-4 sm:py-2.5 sm:text-[1.05rem]";

/**
 * A header link that marks the current section with aria-current. The pathname is unknown while
 * prerendering pages with dynamic params (Cache Components), so the plain link is the Suspense fallback.
 */
export function NavLink({ href, match, className, children }: { href: string; match?: string; className: string; children: ReactNode }) {
  const plain = (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
  if (!match) return plain;
  return (
    <Suspense fallback={plain}>
      <ActiveLink href={href} match={match} className={className}>
        {children}
      </ActiveLink>
    </Suspense>
  );
}
