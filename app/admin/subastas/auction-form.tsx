"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { Field, FormMessage, type FormState, SubmitButton } from "@/components/form";
import { formatAuctionTime, wallClockToInstant } from "@/lib/time";
import { AUCTION_TIMEZONES } from "@/lib/timezones";

export type AuctionFormValues = { title: string; description: string; timezone: string; startsAt: string; endsAt: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: AuctionFormValues;
  id?: string;
  submitLabel: string;
  /** When false, the date/time fields are shown but locked (the auction already started). */
  canEditWindow?: boolean;
  canEditText?: boolean;
};

const noopSubscribe = () => () => {};

/** The viewer's own timezone, only known in the browser (null while server-rendering). */
function useBrowserTimeZone(): string | null {
  return useSyncExternalStore(noopSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);
}

function Preview({ label, value, timeZone }: { label: string; value: string; timeZone: string }) {
  const localZone = useBrowserTimeZone();
  if (!value) return null;
  let instant: Date;
  try {
    instant = wallClockToInstant(value, timeZone);
  } catch {
    return null;
  }
  return (
    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400" data-testid={`preview-${label}`}>
      <span className="font-medium">{label}:</span> {formatAuctionTime(instant, timeZone)}
      {localZone && localZone !== timeZone ? (
        <>
          <br />
          En tu hora local ({localZone}): {formatAuctionTime(instant, localZone)}
        </>
      ) : null}
    </p>
  );
}

export function AuctionForm({ action, defaults, id, submitLabel, canEditWindow = true, canEditText = true }: Props) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const values = (state.values as AuctionFormValues | undefined) ?? defaults;
  const errors = state.fieldErrors ?? {};
  const [timezone, setTimezone] = useState(values.timezone);
  const [startsAt, setStartsAt] = useState(values.startsAt);
  const [endsAt, setEndsAt] = useState(values.endsAt);
  const zoneLabel = AUCTION_TIMEZONES.find((tz) => tz.id === timezone)?.label ?? timezone;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <fieldset disabled={!canEditText} className="flex flex-col gap-5 disabled:opacity-60">
        <Field label="Título" name="title" required maxLength={200} defaultValue={values.title} errors={errors.title} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-description" className="text-sm font-medium">
            Descripción
          </label>
          <textarea
            id="field-description"
            name="description"
            rows={5}
            maxLength={5000}
            defaultValue={values.description}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors.description ? <p className="text-sm text-red-700 dark:text-red-400">{errors.description[0]}</p> : null}
        </div>
      </fieldset>

      <fieldset disabled={!canEditWindow} className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 disabled:opacity-60 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium">Fecha y hora</legend>
        {!canEditWindow ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">La subasta ya empezó: las fechas ya no se pueden cambiar.</p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-timezone" className="text-sm font-medium">
            Zona horaria de la subasta
          </label>
          <select
            id="field-timezone"
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {AUCTION_TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
          {errors.timezone ? <p className="text-sm text-red-700 dark:text-red-400">{errors.timezone[0]}</p> : null}
          <p className="text-sm text-zinc-500">
            Las horas se leen en <strong>{zoneLabel}</strong>, sin importar desde dónde captures la subasta. La subasta empieza en el mismo instante para todos los postores.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Field label="Inicio" name="startsAt" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} errors={errors.startsAt} />
            <Preview label="Inicio" value={startsAt} timeZone={timezone} />
          </div>
          <div className="flex flex-col gap-2">
            <Field label="Cierre" name="endsAt" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} errors={errors.endsAt} />
            <Preview label="Cierre" value={endsAt} timeZone={timezone} />
          </div>
        </div>
      </fieldset>

      {canEditText ? (
        <div>
          <SubmitButton pendingText="Guardando…">{submitLabel}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
