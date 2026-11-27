/**
 * Better Auth configuration. Implements "Bidder registration and approval" in docs/PLAN.md.
 *
 * - Email + password, with email verification required before sign-in.
 * - Sign-up only goes through our Server Action (app/registro/actions.ts), which validates
 *   phone and terms. The public HTTP endpoint is disabled (`disabledPaths`).
 * - New bidders start as `approval_status = 'pending'`. Once they confirm their email, they get
 *   a "your access is being validated" email and the admin gets their details.
 *
 * No `server-only` guard here, because scripts/seed-admin.ts imports it. Never import it from
 * a Client Component.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import * as schema from "./db/schema";
import { queueEmail } from "./email/send";
import {
  adminNewBidderTemplate,
  appUrl,
  registrationReceivedTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "./email/templates";
import { DEFAULT_AUCTION_TIMEZONE, formatAuctionTime } from "./time";

const db = getDb();

export const auth = betterAuth({
  appName: "Subastas del sur",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Extra origins besides BETTER_AUTH_URL, comma-separated (production: the www host, which
  // nginx also serves).
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  telemetry: { enabled: false },
  // Registration must go through the Server Action (phone + terms validation, rate limit).
  disabledPaths: ["/sign-up/email"],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
    // No cookie cache: role and approval status are read fresh on every request.
  },

  user: {
    // Must match the extra columns of `user` in lib/db/schema.ts.
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "bidder", required: false },
      approvalStatus: { type: "string", input: false, defaultValue: "pending", required: false },
      phone: { type: "string", required: true },
      termsAcceptedAt: { type: "date", input: false, required: false },
      reviewedAt: { type: "date", input: false, required: false },
      reviewedBy: { type: "string", input: false, required: false },
      reviewNote: { type: "string", input: false, required: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      queueEmail("reset-password", { to: user.email, ...resetPasswordTemplate({ name: user.name, url }) });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true, // resend the link when an unverified user tries to sign in
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      queueEmail("verify-email", { to: user.email, ...verifyEmailTemplate({ name: user.name, url }) });
    },
    afterEmailVerification: async (verified) => {
      const [bidder] = await db.select().from(schema.user).where(eq(schema.user.id, verified.id));
      if (!bidder || bidder.role !== "bidder" || bidder.approvalStatus !== "pending") return;

      queueEmail("registration-received", { to: bidder.email, ...registrationReceivedTemplate({ name: bidder.name }) });

      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (adminEmail) {
        queueEmail("admin-new-bidder", {
          to: adminEmail,
          replyTo: bidder.email,
          ...adminNewBidderTemplate({
            name: bidder.name,
            email: bidder.email,
            phone: bidder.phone,
            registeredAt: formatAuctionTime(bidder.createdAt, DEFAULT_AUCTION_TIMEZONE),
            reviewUrl: appUrl(`/admin/postores/${bidder.id}`),
          }),
        });
      } else {
        console.error("[auth] ADMIN_NOTIFICATION_EMAIL is not set; admin was not notified of a new bidder");
      }
    },
  },

  databaseHooks: {
    user: {
      create: {
        // The only sign-up path is the Server Action, which requires accepting the terms.
        before: async (data) => ({ data: { ...data, termsAcceptedAt: new Date() } }),
      },
    },
  },

  plugins: [nextCookies()], // keep last: sets cookies from Server Actions
});

export type AuthSession = typeof auth.$Infer.Session;
