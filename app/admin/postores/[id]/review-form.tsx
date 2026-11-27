"use client";

import { useActionState } from "react";
import { FormMessage, type FormState, SubmitButton } from "@/components/form";
import type { ApprovalStatus } from "@/lib/db/schema";
import { reviewBidder } from "./actions";

export function ReviewForm({ id, status, emailVerified }: { id: string; status: ApprovalStatus; emailVerified: boolean }) {
  const [state, action] = useActionState(reviewBidder, {} as FormState);

  if (!emailVerified) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Podrás aprobar o rechazar a este postor cuando confirme su correo.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Nota (opcional; si rechazas, se incluye en el correo al postor)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={1000}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.fieldErrors?.note ? <p className="text-sm text-red-700">{state.fieldErrors.note[0]}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {status !== "approved" ? (
          <SubmitButton name="decision" value="approve" pendingText="Guardando…">
            Aprobar
          </SubmitButton>
        ) : null}
        {status !== "rejected" ? (
          <SubmitButton name="decision" value="reject" variant="danger" pendingText="Guardando…">
            {status === "approved" ? "Revocar aprobación" : "Rechazar"}
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}
