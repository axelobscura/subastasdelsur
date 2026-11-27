"use client";

import { useActionState } from "react";
import { Field, FormMessage, type FormState, SubmitButton } from "@/components/form";
import { requestReset, resetPassword } from "./actions";

export function RequestResetForm() {
  const [state, action] = useActionState(requestReset, {} as FormState);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Correo electrónico" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <SubmitButton>Enviar enlace</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, {} as FormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={10} errors={errors.password} hint="Mínimo 10 caracteres." />
      <Field label="Confirma tu contraseña" name="passwordConfirm" type="password" autoComplete="new-password" required errors={errors.passwordConfirm} />
      <SubmitButton pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
