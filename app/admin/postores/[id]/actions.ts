"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { requireAdmin } from "@/lib/dal";
import { getDb, user } from "@/lib/db";
import { queueEmail } from "@/lib/email/send";
import { bidderApprovedTemplate, bidderRejectedTemplate } from "@/lib/email/templates";
import { reviewNoteSchema } from "@/lib/validation/auth";

/** Approve or reject a bidder. Re-checks the admin and only touches verified bidder accounts. */
export async function reviewBidder(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = formData.get("decision");
  if (decision !== "approve" && decision !== "reject") return { message: "Acción no válida." };

  const note = reviewNoteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return { fieldErrors: { note: note.error.issues.map((i) => i.message) } };

  const db = getDb();
  const [bidder] = await db
    .select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, status: user.approvalStatus })
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "bidder")));
  if (!bidder) return { message: "No encontramos a este postor." };
  if (!bidder.emailVerified) return { message: "El postor todavía no confirma su correo." };

  const status = decision === "approve" ? "approved" : "rejected";
  if (bidder.status === status) return { ok: true, message: "No hubo cambios." };

  await db
    .update(user)
    .set({ approvalStatus: status, reviewedAt: new Date(), reviewedBy: admin.id, reviewNote: note.data || null })
    .where(eq(user.id, bidder.id));

  queueEmail(
    status === "approved" ? "bidder-approved" : "bidder-rejected",
    {
      to: bidder.email,
      ...(status === "approved" ? bidderApprovedTemplate({ name: bidder.name }) : bidderRejectedTemplate({ name: bidder.name, note: note.data })),
    },
  );

  refresh();
  return { ok: true, message: status === "approved" ? `Aprobaste a ${bidder.name}. Le enviamos un correo.` : `Rechazaste a ${bidder.name}. Le enviamos un correo.` };
}
