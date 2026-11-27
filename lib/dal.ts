/**
 * Data Access Layer: the only place that reads the session. Every page that shows
 * private data, and every Server Action, re-checks here, close to the data.
 * `proxy.ts` only does optimistic redirects.
 *
 * Reading the session reads the request (`headers()`), so callers must render inside <Suspense>.
 */
import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import type { ApprovalStatus, UserRole } from "./db/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
};

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, role, approvalStatus } = session.user;
  return { id, name, email, role: role as UserRole, approvalStatus: approvalStatus as ApprovalStatus };
});

/** Only allow same-site paths as a post-login destination. */
export function safeNextPath(next: unknown, fallback = "/mi-cuenta"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export async function requireUser(next = "/mi-cuenta"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

/** Admin pages and actions. Non-admins get a 404, so the area isn't advertised. */
export async function requireAdmin(next = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (user.role !== "admin") notFound();
  return user;
}

export type BidderCheck =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: "unauthenticated" | "not_bidder" | "not_approved" };

/** For bidding (phase 5): signed in, a bidder, and approved by the admin. */
export async function checkApprovedBidder(): Promise<BidderCheck> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (user.role !== "bidder") return { ok: false, reason: "not_bidder" };
  if (user.approvalStatus !== "approved") return { ok: false, reason: "not_approved" };
  return { ok: true, user };
}
