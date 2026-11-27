/**
 * Email templates (Spanish). Every user-supplied value goes through `esc` in HTML.
 * Each template returns subject, HTML and plain text.
 */
import type { Email } from "./send";

const BRAND = "Subastas del sur";

export function appUrl(path: string): string {
  return new URL(path, process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Content = Omit<Email, "to" | "replyTo">;

function layout({ title, paragraphs, action }: { title: string; paragraphs: string[]; action?: { label: string; url: string } }): Content {
  const button = action
    ? `<p style="margin:28px 0"><a href="${esc(action.url)}" style="background:#18181b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${esc(action.label)}</a></p>
       <p style="font-size:13px;color:#71717a">Si el botón no funciona, copia este enlace en tu navegador:<br><span style="word-break:break-all">${esc(action.url)}</span></p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px">
<tr><td>
<p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin:0 0 16px">${BRAND}</p>
<h1 style="font-size:22px;margin:0 0 20px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px">${p}</p>`).join("\n")}
${button}
</td></tr></table>
<p style="font-size:12px;color:#a1a1aa;margin-top:16px">${BRAND}</p>
</td></tr></table>
</body></html>`;
  const strip = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
  const text = [title, "", ...paragraphs.map(strip), ...(action ? ["", `${action.label}: ${action.url}`] : []), "", BRAND].join("\n");
  return { subject: `${title} · ${BRAND}`, html, text };
}

/** Sent on registration: confirm the email, then the team validates access. */
export function verifyEmailTemplate({ name, url }: { name: string; url: string }): Content {
  return layout({
    title: "Confirma tu correo",
    paragraphs: [
      `Hola ${esc(name)}, gracias por registrarte en ${BRAND}.`,
      "Para continuar, confirma tu correo con el botón de abajo. El enlace es válido por 24 horas.",
      "Después de confirmarlo, nuestro equipo validará tu acceso. Te avisaremos por correo en cuanto tu cuenta sea aprobada; hasta entonces no podrás pujar.",
    ],
    action: { label: "Confirmar mi correo", url },
  });
}

/** Sent once the email is confirmed: access is being validated. */
export function registrationReceivedTemplate({ name }: { name: string }): Content {
  return layout({
    title: "Tu acceso está en validación",
    paragraphs: [
      `Hola ${esc(name)}, confirmamos tu correo y recibimos tu registro.`,
      "Nuestro equipo está validando tu acceso. Cuando terminemos la revisión te enviaremos otro correo. Mientras tanto puedes iniciar sesión y explorar las subastas, pero todavía no podrás pujar.",
    ],
    action: { label: "Ver mi cuenta", url: appUrl("/mi-cuenta") },
  });
}

/** Sent to the admin: a new bidder is waiting for approval. */
export function adminNewBidderTemplate(bidder: {
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
  reviewUrl: string;
}): Content {
  const row = (label: string, value: string) => `<strong>${label}:</strong> ${esc(value)}`;
  return layout({
    title: "Nuevo postor por aprobar",
    paragraphs: [
      "Un nuevo postor confirmó su correo y espera tu aprobación:",
      [row("Nombre", bidder.name), row("Correo", bidder.email), row("Teléfono", bidder.phone), row("Registro", bidder.registeredAt)].join("<br>"),
    ],
    action: { label: "Revisar postor", url: bidder.reviewUrl },
  });
}

export function bidderApprovedTemplate({ name }: { name: string }): Content {
  return layout({
    title: "Tu cuenta fue aprobada",
    paragraphs: [`Hola ${esc(name)}, revisamos tu registro y tu cuenta fue aprobada.`, "Ya puedes participar y pujar en las subastas."],
    action: { label: "Ver subastas", url: appUrl("/") },
  });
}

export function bidderRejectedTemplate({ name, note }: { name: string; note?: string | null }): Content {
  return layout({
    title: "Tu cuenta no fue aprobada",
    paragraphs: [
      `Hola ${esc(name)}, revisamos tu registro y por ahora no pudimos aprobar tu cuenta.`,
      ...(note ? [`<strong>Motivo:</strong> ${esc(note)}`] : []),
      `Si crees que se trata de un error, responde a este correo y con gusto lo revisamos.`,
    ],
  });
}

export function resetPasswordTemplate({ name, url }: { name: string; url: string }): Content {
  return layout({
    title: "Restablece tu contraseña",
    paragraphs: [
      `Hola ${esc(name)}, recibimos una solicitud para restablecer tu contraseña.`,
      "El enlace es válido por 1 hora. Si no fuiste tú, ignora este correo: tu contraseña no cambiará.",
    ],
    action: { label: "Elegir nueva contraseña", url },
  });
}
