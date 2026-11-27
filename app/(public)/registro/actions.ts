"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { allowAction } from "@/lib/rate-limit";
import { formValues, registerSchema } from "@/lib/validation/auth";

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["name", "email", "phone"]);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  if (!(await allowAction("register", 5, 60 * 60 * 1000))) {
    return { message: "Demasiados registros desde esta conexión. Inténtalo más tarde.", values };
  }

  const { name, email, phone, password } = parsed.data;
  try {
    await auth.api.signUpEmail({
      body: { name, email, phone, password, callbackURL: "/cuenta-confirmada" },
      headers: await headers(),
    });
  } catch (error) {
    return { message: authErrorMessage(error), values };
  }

  // Same answer whether or not the email already had an account (no account enumeration).
  return {
    ok: true,
    message: `Te enviamos un correo a ${email}. Abre el enlace para confirmar tu correo. Después nuestro equipo validará tu acceso y te avisaremos por correo.`,
  };
}
