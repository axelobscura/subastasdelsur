"use server";

import { and, eq, like, ne } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { type FieldErrors, displayState, parseAuctionText, parseAuctionWindow, parseAuctionWindowForEdit, permissions, publishProblems, slugify, uniqueSlug } from "@/lib/auctions/rules";
import { audit, diffFields } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { auction, getDb, product, productImage } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { auctionProductCount, auctionProductsWithoutImages } from "@/lib/db/aggregates";
import { dbNow } from "@/lib/db/time";
import { queueEmail } from "@/lib/email/send";
import { auctionCancelledTemplate } from "@/lib/email/templates";
import { auctionBidders } from "@/lib/settlement-db";
import { deleteKeys } from "@/lib/storage";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const FORM_KEYS = ["title", "description", "timezone", "startsAt", "endsAt", "listed"];

function formInput(formData: FormData): Record<string, string> {
  const values = Object.fromEntries(FORM_KEYS.map((k) => [k, String(formData.get(k) ?? "")]));
  // "listed" arrives twice when ticked (hidden "off" + checkbox "on"): any "on" wins.
  values.listed = formData.getAll("listed").includes("on") ? "on" : "off";
  return values;
}

/** Catalog caches (phase 4) are tagged with these. Invalidate them after every write. */
function invalidate(id: string) {
  updateTag("auctions");
  updateTag(`auction:${id}`);
}

async function freeSlug(db: Db | Tx, title: string, exceptId?: string): Promise<string> {
  const base = slugify(title);
  const rows = await db
    .select({ slug: auction.slug })
    .from(auction)
    .where(and(like(auction.slug, `${base}%`), exceptId ? ne(auction.id, exceptId) : undefined));
  return uniqueSlug(base, rows.map((r) => r.slug));
}

function isDuplicateKey(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
  return cause?.code === "ER_DUP_ENTRY";
}

export async function createAuction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("/admin/subastas/nueva");
  const values = formInput(formData);
  const db = getDb();

  const text = parseAuctionText(values);
  const window = parseAuctionWindow(values, { now: await dbNow(db) });
  if (!text.ok || !window.ok) {
    return { fieldErrors: { ...(text.ok ? {} : text.fieldErrors), ...(window.ok ? {} : window.fieldErrors) }, values };
  }

  const id = crypto.randomUUID();
  for (let attempt = 0; ; attempt++) {
    const slug = attempt === 0 ? await freeSlug(db, text.data.title) : `${slugify(text.data.title, 70)}-${crypto.randomUUID().slice(0, 6)}`;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(auction).values({ id, slug, ...text.data, ...window.data, status: "draft", createdBy: admin.id });
        await audit(tx, admin, {
          action: "auction.create",
          entityType: "auction",
          entityId: id,
          entityLabel: text.data.title,
          details: { startsAt: window.data.startsAt.toISOString(), endsAt: window.data.endsAt.toISOString(), timezone: window.data.timezone },
        });
      });
      break;
    } catch (error) {
      if (!isDuplicateKey(error) || attempt >= 2) throw error;
    }
  }

  invalidate(id);
  redirect(`/admin/subastas/${id}?creada=1`);
}

export async function updateAuction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const values = formInput(formData);

  const result = await getDb().transaction(async (tx): Promise<FormState> => {
    const [current] = await tx.select().from(auction).where(eq(auction.id, id)).for("update");
    if (!current) return { message: "No encontramos esta subasta." };
    const now = await dbNow(tx);
    const can = permissions(current, now);
    if (!can.editText) return { message: "Esta subasta está cancelada y ya no se puede editar." };

    const fieldErrors: FieldErrors = {};
    const text = parseAuctionText(values);
    if (!text.ok) Object.assign(fieldErrors, text.fieldErrors);

    let window: { timezone: string; startsAt: Date; endsAt: Date } | undefined;
    if (can.editWindow) {
      const parsed = parseAuctionWindowForEdit(values, { now, currentStartsAt: current.startsAt });
      if (parsed.ok) window = parsed.data;
      else Object.assign(fieldErrors, parsed.fieldErrors);
    }
    if (Object.keys(fieldErrors).length || !text.ok) return { fieldErrors, values };

    // Drafts follow their title in the URL. Once published, the URL stays put.
    const slug = current.status === "draft" && text.data.title !== current.title ? await freeSlug(tx, text.data.title, id) : current.slug;
    const next = { ...text.data, ...(window ?? {}), slug };
    await tx.update(auction).set(next).where(eq(auction.id, id));
    const changes = diffFields(current, next, ["title", "description", "listed", "timezone", "startsAt", "endsAt", "slug"]);
    if (Object.keys(changes).length) await audit(tx, admin, { action: "auction.update", entityType: "auction", entityId: id, entityLabel: next.title, details: changes });
    return { ok: true, message: "Cambios guardados." };
  });

  if (result.ok) {
    invalidate(id);
    refresh();
  }
  return result;
}

export async function changeAuctionStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const intent = formData.get("intent");

  const result = await getDb().transaction(async (tx): Promise<FormState & { deleted?: boolean; keys?: string[]; notify?: { name: string; email: string }[]; title?: string }> => {
    const [current] = await tx.select().from(auction).where(eq(auction.id, id)).for("update");
    if (!current) return { message: "No encontramos esta subasta." };
    const now = await dbNow(tx);
    const can = permissions(current, now);
    const log = (action: string, details?: Record<string, unknown>) => audit(tx, admin, { action, entityType: "auction", entityId: id, entityLabel: current.title, details });

    switch (intent) {
      case "publish": {
        if (!can.publish) return { message: "Solo se puede publicar un borrador." };
        const [facts] = await tx
          .select({ productCount: auctionProductCount, productsWithoutImages: auctionProductsWithoutImages })
          .from(auction)
          .where(eq(auction.id, id));
        const problems = publishProblems({ ...current, ...facts }, now);
        if (problems.length) return { message: `No se puede publicar todavía: ${problems.join(" ")}` };
        await tx.update(auction).set({ status: "published" }).where(eq(auction.id, id));
        await log("auction.publish", { products: facts.productCount });
        return { ok: true, message: "Subasta publicada." };
      }
      case "unpublish": {
        if (!can.unpublish) return { message: "Solo se puede despublicar una subasta que todavía no empieza." };
        await tx.update(auction).set({ status: "draft" }).where(eq(auction.id, id));
        await log("auction.unpublish");
        return { ok: true, message: "La subasta volvió a borrador y ya no es visible al público." };
      }
      case "cancel": {
        if (!can.cancel) return { message: "Esta subasta ya no se puede cancelar." };
        if (formData.get("confirm") !== "on") return { message: "Marca la casilla para confirmar la cancelación." };
        await tx.update(auction).set({ status: "cancelled" }).where(eq(auction.id, id));
        const bidders = await auctionBidders(tx, id);
        await log("auction.cancel", { wasLive: displayState(current, now) === "live", biddersNotified: bidders.length });
        return {
          ok: true,
          message: bidders.length ? `Subasta cancelada. Avisamos por correo a ${bidders.length} postor${bidders.length === 1 ? "" : "es"}.` : "Subasta cancelada.",
          notify: bidders,
          title: current.title,
        };
      }
      case "delete": {
        if (!can.deleteDraft) return { message: "Solo se pueden eliminar borradores." };
        if (formData.get("confirm") !== "on") return { message: "Marca la casilla para confirmar que quieres eliminar el borrador." };
        const images = await tx
          .select({ key: productImage.storageKey })
          .from(productImage)
          .innerJoin(product, eq(product.id, productImage.productId))
          .where(eq(product.auctionId, id));
        await log("auction.delete", { photos: images.length });
        await tx.delete(auction).where(eq(auction.id, id)); // products and image rows cascade
        return { ok: true, deleted: true, keys: images.map((i) => i.key) };
      }
      default:
        return { message: "Acción no válida." };
    }
  });

  if (result.ok) invalidate(id);
  for (const bidder of result.notify ?? []) {
    queueEmail("auction-cancelled", { to: bidder.email, ...auctionCancelledTemplate({ name: bidder.name, auctionTitle: result.title ?? "" }) });
  }
  if (result.deleted) {
    await deleteKeys(result.keys ?? []); // after the commit
    redirect("/admin/subastas?eliminada=1");
  }
  if (result.ok) refresh();
  return { ok: result.ok, message: result.message };
}
