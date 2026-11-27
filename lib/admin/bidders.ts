/**
 * Admin data access for bidders. Every function checks `requireAdmin()` itself.
 */
import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { requireAdmin } from "../dal";
import { type ApprovalStatus, getDb, user } from "../db";

export type BidderRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  approvalStatus: ApprovalStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  reviewerName: string | null;
};

const bidderColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  emailVerified: user.emailVerified,
  approvalStatus: user.approvalStatus,
  createdAt: user.createdAt,
  reviewedAt: user.reviewedAt,
  reviewNote: user.reviewNote,
};

/** Tabs of /admin/postores. "Pendientes" only lists bidders who confirmed their email. */
export const bidderTabs = {
  pendientes: { label: "Pendientes", status: "pending", verified: true },
  aprobados: { label: "Aprobados", status: "approved", verified: undefined },
  rechazados: { label: "Rechazados", status: "rejected", verified: undefined },
  "sin-confirmar": { label: "Sin confirmar correo", status: "pending", verified: false },
} as const satisfies Record<string, { label: string; status: ApprovalStatus; verified: boolean | undefined }>;

export type BidderTab = keyof typeof bidderTabs;

export function parseBidderTab(value: unknown): BidderTab {
  return typeof value === "string" && value in bidderTabs ? (value as BidderTab) : "pendientes";
}

export async function listBidders(tab: BidderTab): Promise<BidderRow[]> {
  await requireAdmin("/admin/postores");
  const { status, verified } = bidderTabs[tab];
  const rows = await getDb()
    .select(bidderColumns)
    .from(user)
    .where(
      and(
        eq(user.role, "bidder"),
        eq(user.approvalStatus, status),
        verified === undefined ? undefined : eq(user.emailVerified, verified),
      ),
    )
    .orderBy(desc(user.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, reviewerName: null }));
}

/** Bidder counts by status. Pending only counts bidders who confirmed their email. */
export async function bidderCounts(): Promise<Record<ApprovalStatus, number> & { unverified: number }> {
  await requireAdmin();
  const rows = await getDb()
    .select({ status: user.approvalStatus, verified: user.emailVerified, n: count() })
    .from(user)
    .where(eq(user.role, "bidder"))
    .groupBy(user.approvalStatus, user.emailVerified);
  const counts = { pending: 0, approved: 0, rejected: 0, unverified: 0 };
  for (const r of rows) {
    if (r.status === "pending" && !r.verified) counts.unverified += r.n;
    else counts[r.status] += r.n;
  }
  return counts;
}

export async function getBidder(id: string): Promise<BidderRow | null> {
  await requireAdmin(`/admin/postores/${id}`);
  const db = getDb();
  const [row] = await db
    .select({ ...bidderColumns, reviewedBy: user.reviewedBy })
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "bidder")));
  if (!row) return null;
  let reviewerName: string | null = null;
  if (row.reviewedBy) {
    const [reviewer] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.reviewedBy));
    reviewerName = reviewer?.name ?? null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    emailVerified: row.emailVerified,
    approvalStatus: row.approvalStatus,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    reviewerName,
  };
}
