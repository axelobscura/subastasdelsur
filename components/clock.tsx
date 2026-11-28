"use client";

/**
 * Time on the visitor's screen (PLAN timezone rules 5 and 6):
 * - `useServerNow` ticks from the server's clock, not the device's. The page passes the server
 *   time it was rendered at; the hook keeps `offset = serverNow - Date.now()`, so a wrong device
 *   clock can't make a countdown lie. The first render uses `serverNow` on both server and client,
 *   so there's no hydration mismatch.
 * - `LocalTime` adds the visitor's own local time. The browser zone is only known on the client.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { auctionPhase, formatAuctionTime, formatCountdown } from "@/lib/time";

const noopSubscribe = () => () => {};

/** The viewer's timezone (null while rendering on the server). */
export function useBrowserTimeZone(): string | null {
  return useSyncExternalStore(noopSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}

/**
 * The current server time, ticking. `offsetOverride` lets a component that polls the server
 * (LiveLot) re-sync the offset from each fresh `serverNow`.
 */
export function useServerNow(serverNow: number, intervalMs = 1000, offsetOverride?: number): number {
  const [initialOffset] = useState(() => serverNow - Date.now());
  const offset = offsetOverride ?? initialOffset;
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [offset, intervalMs]);
  return now;
}

type ClockProps = {
  startsAt: number;
  endsAt: number;
  serverNow: number;
  status: "draft" | "published" | "cancelled";
  size?: "sm" | "lg";
};

const BADGE = {
  upcoming: { label: "Próxima", className: "bg-brand-soft text-brand-strong" },
  live: { label: "En vivo", className: "bg-red-50 text-red-800 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-100 dark:ring-red-900" },
  ended: { label: "Finalizada", className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
  draft: { label: "Borrador", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
} as const;

/** The pulsing red dot of an auction that is open right now. */
export function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span className="absolute inline-flex size-full rounded-full bg-live opacity-70 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  );
}

/** Phase badge plus countdown ("Empieza en…" / "Termina en…"), from the server clock. */
export function AuctionClock({ serverNow, ...props }: ClockProps) {
  return <AuctionClockView {...props} now={useServerNow(serverNow)} />;
}

/** The same, for a component that already tracks the server time itself. */
export function AuctionClockView({ startsAt, endsAt, now, status, size = "sm" }: Omit<ClockProps, "serverNow"> & { now: number }) {
  const phase = auctionPhase(new Date(startsAt), new Date(endsAt), new Date(now));
  const badge = status === "published" ? BADGE[phase] : BADGE[status];
  const text =
    status === "cancelled"
      ? null
      : phase === "upcoming"
        ? `Empieza en ${formatCountdown(startsAt - now)}`
        : phase === "live"
          ? `Termina en ${formatCountdown(endsAt - now)}`
          : "Terminó";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${size === "lg" ? "text-base" : "text-sm"}`} data-testid="auction-clock" data-phase={status === "published" ? phase : status}>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
        {status === "published" && phase === "live" ? <LiveDot /> : null}
        {badge.label}
      </span>
      {text ? (
        <span className={`tabular-nums text-zinc-700 dark:text-zinc-300 ${size === "lg" ? "font-medium" : ""}`} data-testid="countdown">
          {text}
        </span>
      ) : null}
    </div>
  );
}

/** "En tu hora local (Asia/Tokyo): …", shown only when the viewer's zone differs. */
export function LocalTime({ instant, auctionTimeZone }: { instant: number; auctionTimeZone: string }) {
  const zone = useBrowserTimeZone();
  if (!zone || zone === auctionTimeZone) return null;
  return (
    <span className="block text-sm font-normal text-zinc-500" data-testid="local-time">
      En tu hora local ({zone}): {formatAuctionTime(new Date(instant), zone)}
    </span>
  );
}
