"use client";

/**
 * The big countdown on the navy board (home hero, auction page). Same clock as AuctionClock: it
 * ticks from the server's time (useServerNow), so a wrong device clock can't change it.
 * Drafts count down like published auctions (the admin's preview); cancelled ones show no clock.
 */
import { auctionPhase, formatCountdown } from "@/lib/time";
import { LiveDot, useServerNow } from "./clock";

type Props = {
  startsAt: number;
  endsAt: number;
  serverNow: number;
  status?: "draft" | "published" | "cancelled";
  size?: "md" | "lg";
};

export function CountdownBoard({ startsAt, endsAt, serverNow, status = "published", size = "md" }: Props) {
  const now = useServerNow(serverNow);
  const phase = auctionPhase(new Date(startsAt), new Date(endsAt), new Date(now));

  if (status === "cancelled") return <p className="font-display text-3xl text-white">Subasta cancelada</p>;
  if (phase === "ended") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-300">Estado</p>
        <p className="font-display text-4xl text-white sm:text-5xl">Subasta terminada</p>
      </div>
    );
  }

  const target = phase === "upcoming" ? startsAt : endsAt;
  const left = target - now;
  const total = Math.max(0, Math.floor(left / 1000));
  const label = phase === "upcoming" ? "Empieza en" : "Cierra en";
  const parts = [
    { value: Math.floor(total / 86_400), label: "días" },
    { value: Math.floor((total % 86_400) / 3600), label: "horas" },
    { value: Math.floor((total % 3600) / 60), label: "min" },
    { value: total % 60, label: "seg" },
  ];
  const digits = size === "lg" ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl";

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        {phase === "live" && status === "published" ? <LiveDot /> : null}
        {phase === "live" && status === "published" ? "En vivo, cierra en" : label}
      </p>
      {/* The same time as text, for screen readers (and tests) */}
      <p className="sr-only" data-testid="countdown">
        {label} {formatCountdown(left)}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3" aria-hidden>
        {parts.map((p) => (
          <div key={p.label} className="flex flex-col items-center rounded-lg border border-board-line bg-white/[0.03] px-1 py-2.5 sm:py-3.5">
            <span className={`font-display leading-none text-signal tabular-nums ${digits}`}>{String(p.value).padStart(2, "0")}</span>
            <span className="mt-1.5 text-xs text-zinc-400 sm:text-sm">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
