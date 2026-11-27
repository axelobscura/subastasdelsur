import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Escribe un correo válido." }).max(255, { error: "El correo es demasiado largo." }));

const password = z
  .string()
  .min(10, { error: "La contraseña debe tener al menos 10 caracteres." })
  .max(128, { error: "La contraseña es demasiado larga." });

/** Mexican or international numbers: 10–15 digits, with optional +, spaces, dashes, parentheses. */
const phone = z
  .string()
  .trim()
  .refine((v) => /^\+?[\d\s().-]+$/.test(v), { error: "Escribe un teléfono válido (solo números)." })
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return digits >= 10 && digits <= 15;
  }, { error: "El teléfono debe tener entre 10 y 15 dígitos." });

export const registerSchema = z
  .object({
    name: z.string().trim().min(3, { error: "Escribe tu nombre completo." }).max(120, { error: "El nombre es demasiado largo." }),
    email,
    phone,
    password,
    passwordConfirm: z.string(),
    terms: z.literal("on", { error: "Debes aceptar los términos y condiciones." }),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], error: "Las contraseñas no coinciden." });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

export const requestResetSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ token: z.string().min(1), password, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], error: "Las contraseñas no coinciden." });

export const reviewNoteSchema = z.string().trim().max(1000, { error: "La nota es demasiado larga (máx. 1000)." });

/** Form fields as strings (for re-filling the form after an error). Passwords never echo back. */
export function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
