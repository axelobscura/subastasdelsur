"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { allowAction } from "@/lib/rate-limit";
import { formValues, requestResetSchema, resetPasswordSchema } from "@/lib/validation/auth";

export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = requestResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  if (!(await allowAction("request-reset", 5, 60 * 60 * 1000))) {
    return { message: "Demasiadas solicitudes. Inténtalo más tarde.", values };
  }
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/restablecer" },
      headers: await headers(),
    });
  } catch (error) {
    return { message: authErrorMessage(error), values };
  }
  // Same answer whether or not the account exists.
  return { ok: true, message: "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña." };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token } });
  } catch (error) {
    return { message: authErrorMessage(error) };
  }
  redirect("/entrar?restablecida=1");
}
