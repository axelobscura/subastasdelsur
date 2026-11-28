"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A link with aria-current="page" while the pathname is `match` or below it. */
export function ActiveLink({ href, match, className, children }: { href: string; match: string; className: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === match || pathname.startsWith(`${match}/`);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
