"use server";

import { and, asc, count, eq, max } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { displayState, permissions } from "@/lib/auctions/rules";
import { requireAdmin } from "@/lib/dal";
import { auction, getDb, product, productImage } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { dbNow } from "@/lib/db/time";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_PRODUCT, parseProductPricing, productTextSchema, reorderImages } from "@/lib/products/rules";
import { UnsupportedImageError, deleteKeys, saveProductImage } from "@/lib/storage";
import { formValues } from "@/lib/validation/auth";
import { z } from "zod";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const FIELDS = ["lotNumber", "title", "description", "startingPrice", "minIncrement", "reservePrice"];

/** Lock the auction row (product changes depend on its state) and read the DB clock. */
async function lockAuction(tx: Tx, auctionId: string) {
  const [row] = await tx.select().from(auction).where(eq(auction.id, auctionId)).for("update");
  if (!row) return null;
  const now = await dbNow(tx);
  return { auction: row, now, can: permissions(row, now), state: displayState(row, now) };
}

function invalidate(auctionId: string, productId?: string) {
  updateTag("auctions");
  updateTag(`auction:${auctionId}`);
  if (productId) updateTag(`product:${productId}`);
}

function isDuplicateKey(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
  return cause?.code === "ER_DUP_ENTRY";
}

const DUPLICATE_LOT: FormState["fieldErrors"] = { lotNumber: ["Ya hay un producto con ese número de lote en esta subasta."] };

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const auctionId = String(formData.get("auctionId") ?? "");
  const values = formValues(formData, FIELDS);
  const text = productTextSchema.safeParse(values);
  const pricing = parseProductPricing(values);
  if (!text.success || !pricing.ok) {
    return { values, fieldErrors: { ...(text.success ? {} : z.flattenError(text.error).fieldErrors), ...(pricing.ok ? {} : pricing.fieldErrors) } };
  }

  const id = crypto.randomUUID();
  let result: FormState;
  try {
    result = await getDb().transaction(async (tx): Promise<FormState> => {
      const locked = await lockAuction(tx, auctionId);
      if (!locked) return { message: "No encontramos esta subasta." };
      if (!locked.can.editProducts) return { message: "La subasta ya empezó o está cancelada: ya no se pueden agregar productos.", values };
      const { lotNumber, startingPrice, minIncrement, reservePrice } = pricing.data;
      await tx.insert(product).values({
        id,
        auctionId,
        lotNumber,
        position: lotNumber,
        ...text.data,
        startingPriceCents: startingPrice,
        minIncrementCents: minIncrement,
        reservePriceCents: reservePrice,
      });
      return { ok: true };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { values, fieldErrors: DUPLICATE_LOT };
    throw error;
  }
  if (!result.ok) return result;
  invalidate(auctionId, id);
  redirect(`/admin/subastas/${auctionId}/productos/${id}?creado=1`);
}

export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const auctionId = String(formData.get("auctionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const values = formValues(formData, FIELDS);

  let result: FormState;
  try {
    result = await getDb().transaction(async (tx): Promise<FormState> => {
      const locked = await lockAuction(tx, auctionId);
      if (!locked) return { message: "No encontramos esta subasta." };
      if (!locked.can.editProductContent) return { message: "La subasta está cancelada: ya no se puede editar." };

      const text = productTextSchema.safeParse(values);
      // Lot number and prices only while the auction hasn't started (disabled fields aren't submitted).
      const pricing = locked.can.editProducts ? parseProductPricing(values) : null;
      if (!text.success || (pricing && !pricing.ok)) {
        return { values, fieldErrors: { ...(text.success ? {} : z.flattenError(text.error).fieldErrors), ...(pricing && !pricing.ok ? pricing.fieldErrors : {}) } };
      }

      const set: Partial<typeof product.$inferInsert> = { ...text.data };
      if (pricing?.ok) {
        set.lotNumber = pricing.data.lotNumber;
        set.position = pricing.data.lotNumber;
        set.startingPriceCents = pricing.data.startingPrice;
        set.minIncrementCents = pricing.data.minIncrement;
        set.reservePriceCents = pricing.data.reservePrice;
      }
      const [updated] = await tx.update(product).set(set).where(and(eq(product.id, productId), eq(product.auctionId, auctionId)));
      if (updated.affectedRows === 0) return { message: "No encontramos este producto." };
      return { ok: true, message: "Producto guardado." };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { values, fieldErrors: DUPLICATE_LOT };
    throw error;
  }
  if (result.ok) {
    invalidate(auctionId, productId);
    refresh();
  }
  return result;
}

export async function deleteProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const auctionId = String(formData.get("auctionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (formData.get("confirm") !== "on") return { message: "Marca la casilla para confirmar que quieres eliminar el producto." };

  const result = await getDb().transaction(async (tx): Promise<FormState & { keys?: string[] }> => {
    const locked = await lockAuction(tx, auctionId);
    if (!locked) return { message: "No encontramos esta subasta." };
    if (!locked.can.editProducts) return { message: "La subasta ya empezó o está cancelada: ya no se pueden quitar productos." };
    const images = await tx.select({ key: productImage.storageKey }).from(productImage).where(eq(productImage.productId, productId));
    const [deleted] = await tx.delete(product).where(and(eq(product.id, productId), eq(product.auctionId, auctionId)));
    if (deleted.affectedRows === 0) return { message: "No encontramos este producto." };
    return { ok: true, keys: images.map((i) => i.key) };
  });
  if (!result.ok) return result;

  await deleteKeys(result.keys ?? []); // after the commit: the rows are gone, so are the files
  invalidate(auctionId, productId);
  redirect(`/admin/subastas/${auctionId}?producto-eliminado=1`);
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export type UploadResult = { ok: boolean; message: string };

/** One photo per call (the client sends files one by one, each under the size limit). */
export async function uploadProductImage(formData: FormData): Promise<UploadResult> {
  await requireAdmin();
  const auctionId = String(formData.get("auctionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige una foto." };
  const name = file.name.slice(0, 80);
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: `${name}: pesa más de 10 MB.` };

  // Quick check before the (slow) image processing. Rechecked under the lock below.
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(productImage).where(eq(productImage.productId, productId));
  if (n >= MAX_IMAGES_PER_PRODUCT) return { ok: false, message: `Máximo ${MAX_IMAGES_PER_PRODUCT} fotos por producto.` };

  let stored;
  try {
    stored = await saveProductImage(productId, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof UnsupportedImageError) return { ok: false, message: `${name}: ${error.message}` };
    throw error;
  }

  let result: UploadResult;
  try {
    result = await db.transaction(async (tx): Promise<UploadResult> => {
      const locked = await lockAuction(tx, auctionId);
      if (!locked) return { ok: false, message: "No encontramos esta subasta." };
      if (!locked.can.editProductContent) return { ok: false, message: "La subasta está cancelada: ya no se pueden subir fotos." };
      const [owner] = await tx.select({ id: product.id }).from(product).where(and(eq(product.id, productId), eq(product.auctionId, auctionId)));
      if (!owner) return { ok: false, message: "No encontramos este producto." };
      const [{ n: current, last }] = await tx
        .select({ n: count(), last: max(productImage.position) })
        .from(productImage)
        .where(eq(productImage.productId, productId));
      if (current >= MAX_IMAGES_PER_PRODUCT) return { ok: false, message: `Máximo ${MAX_IMAGES_PER_PRODUCT} fotos por producto.` };
      await tx.insert(productImage).values({
        productId,
        storageKey: stored.key,
        width: stored.width,
        height: stored.height,
        position: current === 0 ? 0 : (last ?? 0) + 1,
      });
      return { ok: true, message: `${name}: subida.` };
    });
  } catch (error) {
    await deleteKeys([stored.key]);
    throw error;
  }
  if (!result.ok) {
    await deleteKeys([stored.key]);
    return result;
  }
  invalidate(auctionId, productId);
  refresh();
  return result;
}

export async function changeImage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const auctionId = String(formData.get("auctionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");
  const intent = formData.get("intent");
  if (intent !== "delete" && intent !== "up" && intent !== "down" && intent !== "cover") return { message: "Acción no válida." };

  const result = await getDb().transaction(async (tx): Promise<FormState & { deletedKey?: string }> => {
    const locked = await lockAuction(tx, auctionId);
    if (!locked) return { message: "No encontramos esta subasta." };
    if (!locked.can.editProductContent) return { message: "La subasta está cancelada: ya no se pueden cambiar las fotos." };
    const [owner] = await tx.select({ id: product.id }).from(product).where(and(eq(product.id, productId), eq(product.auctionId, auctionId)));
    if (!owner) return { message: "No encontramos este producto." };
    const images = await tx
      .select({ id: productImage.id, key: productImage.storageKey })
      .from(productImage)
      .where(eq(productImage.productId, productId))
      .orderBy(asc(productImage.position), asc(productImage.createdAt));
    const target = images.find((i) => i.id === imageId);
    if (!target) return { message: "No encontramos esta foto." };

    let order = images.map((i) => i.id);
    if (intent === "delete") {
      // A published auction must keep at least one photo per product (it was required to publish).
      if (images.length === 1 && locked.state !== "draft") return { message: "Este producto ya está publicado y necesita al menos una foto. Sube otra antes de borrar esta." };
      await tx.delete(productImage).where(eq(productImage.id, imageId));
      order = order.filter((id) => id !== imageId);
    } else {
      order = reorderImages(order, imageId, intent);
    }
    for (const [position, id] of order.entries()) {
      await tx.update(productImage).set({ position }).where(eq(productImage.id, id));
    }
    return { ok: true, deletedKey: intent === "delete" ? target.key : undefined };
  });
  if (!result.ok) return { message: result.message };

  if (result.deletedKey) await deleteKeys([result.deletedKey]);
  invalidate(auctionId, productId);
  refresh();
  return { ok: true };
}
