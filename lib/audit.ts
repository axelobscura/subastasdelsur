/**
 * Audit log of admin actions. Write it inside the same transaction as the change, so the log
 * and the data never disagree. Never put secrets or passwords in `details`.
 */
import { sql } from "drizzle-orm";
import type { Db } from "./db/client";
import { type AuditEntity, auditLog } from "./db/schema";

type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AuditActor = { id: string; name: string };

export type AuditEvent = {
  action: string;
  entityType: AuditEntity;
  entityId: string;
  entityLabel: string;
  details?: Record<string, unknown>;
};

export async function audit(db: Executor, actor: AuditActor, event: AuditEvent): Promise<void> {
  await db.insert(auditLog).values({
    actorId: actor.id,
    actorName: actor.name,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    entityLabel: event.entityLabel.slice(0, 300),
    details: event.details && Object.keys(event.details).length ? JSON.stringify(event.details).slice(0, 10_000) : null,
    createdAt: sql`UTC_TIMESTAMP(3)`,
  });
}

const show = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

/** The fields that changed, as { field: [before, after] } (dates as ISO strings). */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>, keys: (keyof T)[]): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    const a = show(before[key]);
    const b = show(after[key]);
    if (a !== b) changes[String(key)] = [a, b];
  }
  return changes;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auction.create": "Creó la subasta",
  "auction.update": "Editó la subasta",
  "auction.publish": "Publicó la subasta",
  "auction.unpublish": "Regresó a borrador",
  "auction.cancel": "Canceló la subasta",
  "auction.delete": "Eliminó el borrador",
  "product.create": "Agregó el lote",
  "product.update": "Editó el lote",
  "product.delete": "Eliminó el lote",
  "product_image.upload": "Subió una foto",
  "product_image.delete": "Eliminó una foto",
  "product_image.reorder": "Reordenó las fotos",
  "bidder.approve": "Aprobó al postor",
  "bidder.reject": "Rechazó al postor",
};
