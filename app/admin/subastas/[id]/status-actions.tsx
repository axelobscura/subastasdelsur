"use client";

import { useActionState } from "react";
import { FormMessage, type FormState, SubmitButton } from "@/components/form";
import type { Permissions } from "@/lib/auctions/rules";
import { changeAuctionStatus } from "../actions";

export function StatusActions({ id, can, publishProblems }: { id: string; can: Permissions; publishProblems: string[] }) {
  const [state, action] = useActionState(changeAuctionStatus, {} as FormState);

  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={state} />

      {can.publish ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          {publishProblems.length ? (
            <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {publishProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Lista para publicar. Al publicarla será visible para todos.</p>
          )}
          <div>
            <SubmitButton name="intent" value="publish" pendingText="Publicando…" disabled={publishProblems.length > 0}>
              Publicar subasta
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {can.unpublish ? (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton name="intent" value="unpublish" variant="secondary" pendingText="Guardando…">
            Volver a borrador
          </SubmitButton>
        </form>
      ) : null}

      {can.cancel ? (
        <form action={action} className="flex flex-col gap-2 rounded-lg border border-red-200 p-4 dark:border-red-900">
          <input type="hidden" name="id" value={id} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" className="mt-1" />
            <span>Confirmo que quiero cancelar esta subasta. No se puede deshacer.</span>
          </label>
          <div>
            <SubmitButton name="intent" value="cancel" variant="danger" pendingText="Cancelando…">
              Cancelar subasta
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {can.deleteDraft ? (
        <form action={action} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <input type="hidden" name="id" value={id} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" className="mt-1" />
            <span>Confirmo que quiero eliminar este borrador y sus productos.</span>
          </label>
          <div>
            <SubmitButton name="intent" value="delete" variant="secondary" pendingText="Eliminando…">
              Eliminar borrador
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
