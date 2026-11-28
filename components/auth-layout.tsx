import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";

/**
 * Sign-in and registration: the form on the left, a photo panel in the brand navy on the right
 * (a short photo banner above the form on phones). Photos are public domain (Wikimedia Commons).
 */
export function AuthLayout({
  title,
  intro,
  children,
  footer,
  photo,
  photoAlt,
  aside,
  wide = false,
  photoPosition = "object-center",
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  photo: StaticImageData;
  photoAlt: string;
  aside: ReactNode;
  /** A wider form column (registration has fields side by side). */
  wide?: boolean;
  /** Tailwind object-position class that keeps the subject of the photo in frame. */
  photoPosition?: string;
}) {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <div className="flex flex-col justify-center lg:py-6">
        {/* Phones and tablets: the photo as a banner above the form */}
        <div className="relative mb-6 h-36 overflow-hidden rounded-2xl sm:h-48 lg:hidden">
          <Image src={photo} alt={photoAlt} fill placeholder="blur" sizes="(min-width: 640px) 90vw, 100vw" className={`object-cover ${photoPosition}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-board/70 via-board/10 to-transparent" />
        </div>

        <div className={`mx-auto w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
          <div className="mt-3 text-zinc-600 dark:text-zinc-400">{intro}</div>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgb(14_27_51/0.06),0_12px_32px_-16px_rgb(14_27_51/0.18)] sm:p-8">{children}</div>
          <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">{footer}</div>
        </div>
      </div>

      {/* Desktop: the photo panel */}
      <aside className="hidden min-h-[36rem] flex-col overflow-hidden rounded-3xl bg-board text-white lg:flex">
        <div className="relative min-h-64 flex-1">
          <Image src={photo} alt={photoAlt} fill placeholder="blur" sizes="(min-width: 1280px) 560px, 50vw" className={`object-cover ${photoPosition}`} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-board" />
        </div>
        <div className="flex flex-col gap-6 px-10 pt-2 pb-10">{aside}</div>
      </aside>
    </main>
  );
}

/** A benefit or step line on the photo panel: icon tile plus text. */
export function AuthPoint({ icon: Icon, title, children, step }: { icon: (props: { className?: string }) => ReactNode; title: string; children: ReactNode; step?: number }) {
  return (
    <li className="flex gap-4">
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-signal backdrop-blur-sm" aria-hidden>
        <Icon className="size-5" />
        {step ? (
          <span className="font-display absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-signal text-xs text-board">{step}</span>
        ) : null}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm leading-relaxed text-zinc-300">{children}</p>
      </div>
    </li>
  );
}
