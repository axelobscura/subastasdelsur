/**
 * Product (lot) rules, pure and unit-tested. Whether a product can be added, priced or
 * removed depends on the auction (`permissions(...).editProducts` in lib/auctions/rules.ts).
 */
import { z } from "zod";
import { parseMoneyToCents } from "../money";

export const MAX_IMAGES_PER_PRODUCT = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const money = (label: string, { optional = false, positive = false } = {}) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") {
        if (optional) return null;
        ctx.addIssue({ code: "custom", message: `Escribe ${label}.` });
        return z.NEVER;
      }
      const cents = parseMoneyToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label[0].toUpperCase()}${label.slice(1)}: escribe una cantidad válida, por ejemplo 1500 o 1,500.50.` });
        return z.NEVER;
      }
      if (positive && cents <= 0) {
        ctx.addIssue({ code: "custom", message: `${label[0].toUpperCase()}${label.slice(1)} debe ser mayor que cero.` });
        return z.NEVER;
      }
      return cents;
    });

export const productTextSchema = z.object({
  title: z.string().trim().min(2, { error: "Escribe el nombre del producto." }).max(200, { error: "El nombre es demasiado largo (máx. 200)." }),
  description: z.string().trim().max(5000, { error: "La descripción es demasiado larga (máx. 5000)." }),
});

export const productPricingSchema = z
  .object({
    lotNumber: z.coerce
      .number({ error: "Escribe el número de lote." })
      .int({ error: "El número de lote debe ser un entero." })
      .min(1, { error: "El número de lote empieza en 1." })
      .max(9999, { error: "El número de lote es demasiado grande." }),
    startingPrice: money("el precio de salida"),
    minIncrement: money("el incremento mínimo", { positive: true }),
    reservePrice: money("el precio de reserva", { optional: true }),
  })
  .refine((v) => v.reservePrice === null || v.startingPrice === null || v.reservePrice >= v.startingPrice, {
    path: ["reservePrice"],
    error: "El precio de reserva no puede ser menor que el precio de salida.",
  });

export type ProductText = z.infer<typeof productTextSchema>;
/** Starting price and increment are always set (only the reserve is optional). */
export type ProductPricing = Omit<z.infer<typeof productPricingSchema>, "startingPrice" | "minIncrement"> & {
  startingPrice: number;
  minIncrement: number;
};

export function parseProductPricing(input: Record<string, unknown>):
  | { ok: true; data: ProductPricing }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> } {
  const parsed = productPricingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  return { ok: true, data: parsed.data as ProductPricing };
}

/** Next free lot number: one more than the highest. */
export function nextLotNumber(existing: number[]): number {
  return existing.length ? Math.max(...existing) + 1 : 1;
}

/**
 * New order of image ids after moving one up/down or making it the cover.
 * Returns the same order if the move isn't possible.
 */
export function reorderImages(ids: string[], id: string, move: "up" | "down" | "cover"): string[] {
  const index = ids.indexOf(id);
  if (index === -1) return ids;
  const next = [...ids];
  if (move === "cover") {
    next.splice(index, 1);
    next.unshift(id);
  } else {
    const target = move === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return ids;
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}
