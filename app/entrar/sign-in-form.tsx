"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Field, FormMessage, type FormState, SubmitButton } from "@/components/form";
import { signIn } from "./actions";

export function SignInForm() {
  const [state, action] = useActionState(signIn, {} as FormState);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const passwordWasReset = searchParams.get("restablecida") === "1";
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {passwordWasReset && !state.message ? <FormMessage state={{ ok: true, message: "Tu contraseña fue actualizada. Ya puedes iniciar sesión." }} /> : null}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <Field label="Correo electrónico" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} errors={errors.email} />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required errors={errors.password} />
      <SubmitButton pendingText="Entrando…">Iniciar sesión</SubmitButton>
      <Link href="/recuperar" className="text-sm underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
