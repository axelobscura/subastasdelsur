"use client";

import { useActionState } from "react";
import { FormMessage, type FormState, SubmitButton } from "@/components/form";
import { deleteProduct } from "../actions";

export function DeleteProduct({ auctionId, productId }: { auctionId: string; productId: string }) {
  const [state, action] = useActionState(deleteProduct, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-red-200 p-4 dark:border-red-900">
      <FormMessage state={state} />
      <input type="hidden" name="auctionId" value={auctionId} />
      <input type="hidden" name="productId" value={productId} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>Confirmo que quiero eliminar este producto y sus fotos.</span>
      </label>
      <div>
        <SubmitButton variant="danger" pendingText="Eliminando…">
          Eliminar producto
        </SubmitButton>
      </div>
    </form>
  );
}
