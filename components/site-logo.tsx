import Image from "next/image";

/**
 * The Subastas del Sur logo (public/logo.svg, 202.5 × 74.5). `tone="auto"` swaps to the
 * light-on-dark version in dark mode; `tone="dark"` always uses it (for navy backgrounds).
 * The images are decorative: put the accessible name on the surrounding link.
 */
export function SiteLogo({ className = "h-10 w-auto", tone = "auto" }: { className?: string; tone?: "auto" | "dark" }) {
  // Tiny SVGs: always load eagerly (no lazy-load flash), never through the image optimizer.
  const props = { width: 203, height: 75, loading: "eager", unoptimized: true } as const;
  if (tone === "dark") return <Image src="/logo-dark.svg" alt="" {...props} className={className} />;
  return (
    <>
      <Image src="/logo.svg" alt="" {...props} className={`${className} dark:hidden`} />
      <Image src="/logo-dark.svg" alt="" {...props} className={`${className} hidden dark:block`} />
    </>
  );
}
