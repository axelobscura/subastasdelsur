/**
 * Transactional email through the Hostinger mailbox (SMTP). See "Bidder registration and
 * approval" in docs/PLAN.md. Imported only by server code (lib/auth.ts, Server Actions).
 */
import { after } from "next/server";
import nodemailer, { type Transporter } from "nodemailer";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendEmail(email: Email): Promise<void> {
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.info(`[email:dry-run] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`);
    // E2E tests read the emails (e.g. the verification link) from this JSON-lines file.
    if (process.env.EMAIL_DRY_RUN_FILE) {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(process.env.EMAIL_DRY_RUN_FILE, JSON.stringify({ to: email.to, subject: email.subject, text: email.text }) + "\n");
    }
    return;
  }
  await getTransporter().sendMail({ from: process.env.EMAIL_FROM, ...email });
}

/**
 * Send without making the caller wait. Inside a request it runs after the response is sent
 * (`after`), so a slow or failing mailbox never breaks the page. Failures are logged with
 * the template name and recipient only, never the content.
 */
export function queueEmail(template: string, email: Email): void {
  const task = () =>
    sendEmail(email).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[email] failed template=${template} to=${email.to}: ${reason}`);
    });
  try {
    after(task);
  } catch {
    // Outside a request (scripts): the long-lived process finishes it on its own.
    void task();
  }
}
