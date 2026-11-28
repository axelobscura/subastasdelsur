/** Reading the audit log (admin only). */
import "server-only";
import { desc, eq, inArray, or } from "drizzle-orm";
import { requireAdmin } from "../dal";
import { type AuditLogEntry, auditLog, getDb, product } from "../db";

export async function listAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  await requireAdmin("/admin/actividad");
  return getDb().select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

/** History of one auction and its lots. */
export async function auctionAuditLog(auctionId: string, limit = 50): Promise<AuditLogEntry[]> {
  await requireAdmin();
  const db = getDb();
  const lots = await db.select({ id: product.id }).from(product).where(eq(product.auctionId, auctionId));
  const ids = [auctionId, ...lots.map((l) => l.id)];
  return db
    .select()
    .from(auditLog)
    .where(or(eq(auditLog.entityId, auctionId), inArray(auditLog.entityId, ids)))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
