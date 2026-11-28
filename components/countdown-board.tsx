"use client";

/**
 * The big countdown on the navy board (home hero). Same clock as AuctionClock: it ticks from the
 * server's time (useServerNow), so a wrong device clock can't change it.
 */
import { auctionPhase } from "@/lib/time";
import { LiveDot, useServerNow } from "./clock";

type Props = { startsAt: number; endsAt: number; serverNow: number };

export function CountdownBoard({ startsAt, endsAt, serverNow }: Props) {
  const now = useServerNow(serverNow);
  const phase = auctionPhase(new Date(startsAt), new Date(endsAt), new Date(now));
  const target = phase === "upcoming" ? startsAt : endsAt;
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const parts = [
    { value: Math.floor(total / 86_400), label: "días" },
    { value: Math.floor((total % 86_400) / 3600), label: "horas" },
    { value: Math.floor((total % 3600) / 60), label: "min" },
    { value: total % 60, label: "seg" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        {phase === "live" ? <LiveDot /> : null}
        {phase === "upcoming" ? "Empieza en" : phase === "live" ? "En vivo, cierra en" : "Terminó"}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-label={parts.map((p) => `${p.value} ${p.label}`).join(", ")}>
        {parts.map((p) => (
          <div key={p.label} className="flex flex-col items-center rounded-lg border border-board-line bg-white/[0.03] px-1 py-2.5 sm:py-3">
            <span className="font-display text-4xl leading-none text-signal tabular-nums sm:text-5xl" aria-hidden>
              {String(p.value).padStart(2, "0")}
            </span>
            <span className="mt-1.5 text-xs text-zinc-400" aria-hidden>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
