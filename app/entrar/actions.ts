"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/dal";
import { allowAction } from "@/lib/rate-limit";
import { formValues, signInSchema } from "@/lib/validation/auth";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  if (!(await allowAction("sign-in", 10, 15 * 60 * 1000))) {
    return { message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.", values };
  }

  let role: string | undefined;
  try {
    const result = await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password, callbackURL: "/cuenta-confirmada" },
      headers: await headers(),
    });
    role = (result.user as { role?: string }).role;
  } catch (error) {
    return { message: authErrorMessage(error), values };
  }

  redirect(safeNextPath(formData.get("next"), role === "admin" ? "/admin" : "/mi-cuenta"));
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
