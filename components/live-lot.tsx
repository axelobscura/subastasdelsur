"use client";

/**
 * The live part of a lot page: price, bid count, minimum next bid, the viewer's standing, the
 * bid form and the bid history. Polls /api/lotes/<id>/estado while it matters (every 3s while
 * live, slower in a background tab) and re-syncs the clock from each response's serverNow.
 * The server decides everything (placeBid); this only shows and submits.
 */
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { placeBid, type BidResult } from "@/app/(public)/subastas/[slug]/[lote]/actions";
import type { LotState } from "@/lib/bids-db";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/money";
import { auctionPhase } from "@/lib/time";
import { AuctionClockView, useServerNow } from "./clock";
import { IconGavel, IconHistory } from "./icons";
import { Notice } from "./ui";

export type Viewer = "guest" | "admin" | "pending" | "rejected" | "approved";

type Props = { initial: LotState; viewer: Viewer; loginHref: string; auctionTimeZone: string };

const POLL_LIVE_MS = 3000;
const POLL_HIDDEN_MS = 15000;
const POLL_UPCOMING_MS = 15000;

export function LiveLot({ initial, viewer, loginHref, auctionTimeZone }: Props) {
  const [state, setState] = useState(initial);
  const [offset, setOffset] = useState<number | undefined>(undefined);
  const now = useServerNow(initial.serverNow, 1000, offset);
  const phase = auctionPhase(new Date(state.startsAt), new Date(state.endsAt), new Date(now));
  const status = state.status;

  function accept(next: LotState) {
    setState(next);
    setOffset(next.serverNow - Date.now());
  }

  // Polling: fast while live, slower when upcoming or the tab is hidden, stop once it's over.
  const finished = status !== "published" || (phase === "ended" && state.phase === "ended");
  useEffect(() => {
    if (finished) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/lotes/${state.productId}/estado`, { cache: "no-store" });
        if (res.ok && !cancelled) accept((await res.json()) as LotState);
      } catch {
        // offline for a moment: try again next round
      }
      if (cancelled) return;
      const delay = document.hidden ? POLL_HIDDEN_MS : phase === "live" || phase === "ended" ? POLL_LIVE_MS : POLL_UPCOMING_MS;
      timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, phase === "live" ? POLL_LIVE_MS : POLL_UPCOMING_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.productId, phase, finished]);

  const hasBids = state.bidCount > 0 && state.currentPriceCents !== null;

  return (
    <section aria-label="Pujas" className="flex flex-col gap-4" data-testid="live-lot">
      <AuctionClockView startsAt={state.startsAt} endsAt={state.endsAt} now={now} status={status} size="lg" />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-board-line text-white" data-testid="lot-prices" aria-live="polite">
        <div className="col-span-2 bg-board p-5 sm:p-6">
          <dt className="text-sm text-zinc-300">{hasBids ? (phase === "ended" ? "Puja final" : "Puja actual") : "Precio de salida"}</dt>
          <dd className="font-display mt-1 text-5xl leading-none text-signal tabular-nums sm:text-6xl" data-testid="current-price">
            {formatMoney(hasBids ? state.currentPriceCents! : state.startingPriceCents)}
          </dd>
          <dd className="mt-2 text-sm text-zinc-300" data-testid="bid-count">
            {state.bidCount === 0 ? "Sin pujas" : state.bidCount === 1 ? "1 puja" : `${state.bidCount} pujas`}
          </dd>
        </div>
        <div className={`bg-board p-4 sm:px-6 ${state.reserve === "none" ? "col-span-2" : ""}`}>
          <dt className="text-sm text-zinc-300">{phase === "ended" ? "Incremento mínimo" : "Puja mínima"}</dt>
          <dd className="font-display mt-1 text-2xl tabular-nums" data-testid="minimum-bid">
            {formatMoney(phase === "ended" ? state.minIncrementCents : state.minimumNextCents)}
          </dd>
          {phase !== "ended" ? <dd className="text-xs text-zinc-400">Incremento mínimo {formatMoney(state.minIncrementCents)}</dd> : null}
        </div>
        {state.reserve !== "none" ? (
          <div className="bg-board p-4 sm:px-6">
            <dt className="text-sm text-zinc-300">Reserva</dt>
            <dd className="mt-1 text-sm font-semibold" data-testid="reserve">
              {state.reserve === "met" ? "Precio de reserva alcanzado" : "Precio de reserva no alcanzado"}
            </dd>
          </div>
        ) : null}
      </dl>

      {phase === "ended" && status === "published" ? (
        <p className="font-display text-2xl" data-testid="lot-outcome">
          {!hasBids ? "Sin pujas: este lote no se vendió." : state.reserve === "not_met" ? "No se vendió: no se alcanzó el precio de reserva." : `Vendido por ${formatMoney(state.currentPriceCents!)}.`}
        </p>
      ) : null}

      {state.you?.isLeading && phase === "ended" && state.reserve === "not_met" ? (
        <Notice tone="warning" title="Tu puja fue la más alta">
          Pero no alcanzó el precio de reserva, así que el lote no se vendió.
        </Notice>
      ) : state.you?.isLeading ? (
        <Notice tone="success" title={phase === "ended" ? "Tu puja fue la más alta" : "Vas ganando"}>
          {phase === "ended" ? "¡Ganaste este lote! Te contactaremos con los siguientes pasos." : "Tienes la puja más alta en este lote."}
        </Notice>
      ) : state.you?.hasBid ? (
        <Notice tone="warning" title="Te superaron">
          {phase === "live" ? "Alguien pujó más que tú. Puedes volver a pujar." : "Alguien pujó más que tú."}
        </Notice>
      ) : null}

      <BidPanel state={state} phase={phase} viewer={viewer} loginHref={loginHref} onResult={(r) => r.state && accept(r.state)} />

      <History state={state} auctionTimeZone={auctionTimeZone} />
    </section>
  );
}

function BidPanel({ state, phase, viewer, loginHref, onResult }: { state: LotState; phase: string; viewer: Viewer; loginHref: string; onResult: (r: BidResult) => void }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(centsToInput(state.minimumNextCents));
  const [confirming, setConfirming] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<BidResult | null>(null);
  const [seenMinimum, setSeenMinimum] = useState(state.minimumNextCents);

  // When someone outbids the amount typed in, move it up to the new minimum
  // (adjusting state while rendering when a prop changes, as React recommends).
  if (seenMinimum !== state.minimumNextCents) {
    setSeenMinimum(state.minimumNextCents);
    const typed = parseMoneyToCents(amount);
    if (typed === null || typed < state.minimumNextCents) setAmount(centsToInput(state.minimumNextCents));
  }

  if (state.status === "cancelled") return null;
  if (viewer === "guest") {
    return (
      <Notice title="¿Quieres pujar?">
        <Link href={loginHref} className="font-medium underline">
          Inicia sesión
        </Link>{" "}
        o{" "}
        <Link href="/registro" className="font-medium underline">
          regístrate como postor
        </Link>
        . Nuestro equipo valida cada cuenta antes de habilitar las pujas.
      </Notice>
    );
  }
  if (viewer === "admin") return <Notice>Estás viendo la página como administrador.</Notice>;
  if (viewer === "pending") return <Notice tone="warning" title="Tu cuenta está en revisión">Podrás pujar en cuanto nuestro equipo apruebe tu cuenta. Te avisaremos por correo.</Notice>;
  if (viewer === "rejected") return <Notice tone="danger">Tu cuenta no fue aprobada para pujar.</Notice>;
  if (phase === "upcoming") return <Notice>Las pujas abren cuando empiece la subasta.</Notice>;
  if (phase === "ended") return <Notice>La subasta terminó: ya no se reciben pujas.</Notice>;

  const cents = parseMoneyToCents(amount);

  function submit(value: number) {
    setConfirming(null);
    startTransition(async () => {
      try {
        const result = await placeBid(state.productId, centsToInput(value));
        setFeedback(result);
        onResult(result);
      } catch {
        setFeedback({ ok: false, message: "No pudimos enviar tu puja. Revisa tu conexión e inténtalo de nuevo.", state: null });
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents === null) return setFeedback({ ok: false, message: "Escribe una cantidad válida, por ejemplo 1500 o 1,500.50.", state: null });
        // Big jumps (3× the minimum or more) need a second click: usually a typo.
        if (cents >= state.minimumNextCents * 3 && confirming !== cents) return setConfirming(cents);
        submit(cents);
      }}
    >
      <label htmlFor="bid-amount" className="text-sm font-semibold">
        Tu puja (mínimo {formatMoney(state.minimumNextCents)})
      </label>
      <div className="flex gap-2">
        <input
          id="bid-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setConfirming(null);
          }}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-surface px-3 py-2.5 text-xl font-semibold tabular-nums outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-signal inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-lg font-bold transition hover:brightness-105 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
        >
          <IconGavel aria-hidden className="size-5 shrink-0" />
          {pending ? "Enviando…" : confirming !== null ? `Confirmar ${formatMoney(confirming)}` : "Pujar"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {[1, 2, 5].map((n) => {
          const value = state.minimumNextCents + (n - 1) * state.minIncrementCents;
          return (
            <button key={n} type="button" onClick={() => setAmount(centsToInput(value))} className="rounded-full border border-zinc-300 px-3 py-1 font-medium tabular-nums hover:border-brand hover:text-brand dark:border-zinc-700">
              {formatMoney(value)}
            </button>
          );
        })}
      </div>
      {confirming !== null ? (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
          Es mucho más que la puja mínima. ¿Seguro? Pulsa «Confirmar» para enviarla.
        </p>
      ) : null}
      {feedback ? (
        <p role={feedback.ok ? "status" : "alert"} data-testid="bid-feedback" className={`text-sm ${feedback.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-400"}`}>
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

function History({ state, auctionTimeZone }: { state: LotState; auctionTimeZone: string }) {
  if (!state.history.length) return null;
  const time = new Intl.DateTimeFormat("es-MX", { timeZone: auctionTimeZone, dateStyle: "short", timeStyle: "medium", hourCycle: "h23" });
  return (
    <div className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <IconHistory aria-hidden className="size-4 shrink-0 text-brand" />
        Historial de pujas
      </h2>
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm" data-testid="bid-history">
        {state.history.map((h, i) => (
          <li key={`${h.amountCents}-${h.at}`} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i === 0 ? "bg-brand-soft font-semibold" : ""}`}>
            <span>
              {h.label}
              {h.isYou ? <span className="text-zinc-500"> (tú)</span> : null}
            </span>
            <span className="tabular-nums">{formatMoney(h.amountCents)}</span>
            <span className="text-xs text-zinc-500 tabular-nums">{time.format(new Date(h.at))}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
