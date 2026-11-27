"use client";

import { useActionState } from "react";
import { type FormState, SubmitButton } from "@/components/form";
import { changeImage } from "../actions";

type Props = { auctionId: string; productId: string; imageId: string; isFirst: boolean; isLast: boolean };

export function ImageControls({ auctionId, productId, imageId, isFirst, isLast }: Props) {
  const [state, action] = useActionState(changeImage, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="auctionId" value={auctionId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="imageId" value={imageId} />
      <div className="flex flex-wrap gap-1 text-xs">
        {!isFirst ? (
          <>
            <SubmitButton name="intent" value="cover" variant="secondary" pendingText="…">
              Portada
            </SubmitButton>
            <SubmitButton name="intent" value="up" variant="secondary" pendingText="…" aria-label="Mover antes">
              ←
            </SubmitButton>
          </>
        ) : null}
        {!isLast ? (
          <SubmitButton name="intent" value="down" variant="secondary" pendingText="…" aria-label="Mover después">
            →
          </SubmitButton>
        ) : null}
        <SubmitButton name="intent" value="delete" variant="danger" pendingText="…">
          Eliminar
        </SubmitButton>
      </div>
      {state.message ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
