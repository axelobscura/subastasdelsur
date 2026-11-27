"use client";

import { useActionState } from "react";
import { Field, FormMessage, type FormState, SubmitButton } from "@/components/form";
import { register } from "./actions";

export function RegisterForm() {
  const [state, action] = useActionState(register, {} as FormState);
  const errors = state.fieldErrors ?? {};

  if (state.ok) return <FormMessage state={state} />;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Nombre completo" name="name" autoComplete="name" required defaultValue={state.values?.name} errors={errors.name} />
      <Field label="Correo electrónico" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} errors={errors.email} />
      <Field label="Teléfono" name="phone" type="tel" autoComplete="tel" required defaultValue={state.values?.phone} errors={errors.phone} hint="10 dígitos, o con lada internacional (+52…)." />
      <Field label="Contraseña" name="password" type="password" autoComplete="new-password" required minLength={10} errors={errors.password} hint="Mínimo 10 caracteres." />
      <Field label="Confirma tu contraseña" name="passwordConfirm" type="password" autoComplete="new-password" required errors={errors.passwordConfirm} />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" className="mt-1" aria-invalid={errors.terms ? true : undefined} />
          <span>Acepto los términos y condiciones y el aviso de privacidad.</span>
        </label>
        {errors.terms ? <p className="text-sm text-red-700 dark:text-red-400">{errors.terms[0]}</p> : null}
      </div>
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Después de confirmar tu correo, nuestro equipo validará tu acceso antes de que puedas pujar.
      </p>
    </form>
  );
}
