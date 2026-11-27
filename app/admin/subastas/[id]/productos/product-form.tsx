"use client";

import { useActionState } from "react";
import { Field, FormMessage, type FormState, SubmitButton } from "@/components/form";

export type ProductFormValues = {
  lotNumber: string;
  title: string;
  description: string;
  startingPrice: string;
  minIncrement: string;
  reservePrice: string;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  auctionId: string;
  productId?: string;
  defaults: ProductFormValues;
  submitLabel: string;
  canEditPricing: boolean;
  canEditContent: boolean;
  currency: string;
};

export function ProductForm({ action, auctionId, productId, defaults, submitLabel, canEditPricing, canEditContent, currency }: Props) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const values = (state.values as ProductFormValues | undefined) ?? defaults;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="auctionId" value={auctionId} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}

      <fieldset disabled={!canEditContent} className="flex flex-col gap-5 disabled:opacity-60">
        <Field label="Nombre del producto" name="title" required maxLength={200} defaultValue={values.title} errors={errors.title} />
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

      <fieldset disabled={!canEditPricing} className="grid gap-4 rounded-lg border border-zinc-200 p-4 disabled:opacity-60 sm:grid-cols-2 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium">Lote y precios ({currency})</legend>
        {!canEditPricing ? (
          <p className="text-sm text-zinc-600 sm:col-span-2 dark:text-zinc-400">La subasta ya empezó: el lote y los precios ya no se pueden cambiar.</p>
        ) : null}
        <Field label="Número de lote" name="lotNumber" inputMode="numeric" required defaultValue={values.lotNumber} errors={errors.lotNumber} />
        <Field label="Precio de salida" name="startingPrice" inputMode="decimal" required defaultValue={values.startingPrice} errors={errors.startingPrice} hint="Por ejemplo 1500 o 1,500.50" />
        <Field label="Incremento mínimo por puja" name="minIncrement" inputMode="decimal" required defaultValue={values.minIncrement} errors={errors.minIncrement} />
        <Field
          label="Precio de reserva (opcional)"
          name="reservePrice"
          inputMode="decimal"
          defaultValue={values.reservePrice}
          errors={errors.reservePrice}
          hint="Si la puja más alta no lo alcanza, el producto no se vende."
        />
      </fieldset>

      {canEditContent ? (
        <div>
          <SubmitButton pendingText="Guardando…">{submitLabel}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
