import { APIError } from "better-auth/api";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  EMAIL_NOT_VERIFIED: "Primero confirma tu correo. Te enviamos de nuevo el enlace de confirmación.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 10 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  INVALID_EMAIL: "El correo no es válido.",
  INVALID_TOKEN: "El enlace no es válido o ya expiró. Solicita uno nuevo.",
};

/** Spanish message for a Better Auth error. Unknown errors are logged and get a generic message. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (error.status === "TOO_MANY_REQUESTS") return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }
  console.error("[auth] unexpected error", error);
  return "Ocurrió un error. Inténtalo de nuevo en unos minutos.";
}
