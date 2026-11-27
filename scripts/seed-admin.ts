/**
 * Create or update the admin account from ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD.
 * `npm run db:seed-admin` (tunnel up locally). Idempotent: running it again keeps the
 * existing password unless you pass --reset-password. Never deletes anything.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  // Imported after loading env: lib/auth reads its settings at import time.
  const { auth } = await import("../lib/auth");
  const { getDb } = await import("../lib/db/client");

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  const password = process.env.ADMIN_PASSWORD;
  const resetPassword = process.argv.includes("--reset-password");
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (see .env.local)");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");

  const ctx = await auth.$context;
  const adminFields = { role: "admin", approvalStatus: "approved", emailVerified: true };

  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  if (!existing) {
    const created = await ctx.internalAdapter.createUser(
      { email, name, phone: process.env.ADMIN_PHONE ?? "", ...adminFields },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await ctx.password.hash(password),
    });
    console.log(`Created admin ${email}`);
  } else {
    await ctx.internalAdapter.updateUser(existing.user.id, adminFields);
    const credential = existing.accounts.find((a) => a.providerId === "credential");
    if (!credential) {
      await ctx.internalAdapter.linkAccount({
        userId: existing.user.id,
        providerId: "credential",
        accountId: existing.user.id,
        password: await ctx.password.hash(password),
      });
      console.log(`Updated ${email} to admin and set its password`);
    } else if (resetPassword) {
      await ctx.internalAdapter.updatePassword(existing.user.id, await ctx.password.hash(password));
      console.log(`Updated ${email} to admin and reset its password`);
    } else {
      console.log(`Updated ${email} to admin (password unchanged; pass --reset-password to reset it)`);
    }
  }

  // Close the pool so the script exits.
  await (getDb().$client as { end(): Promise<void> }).end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
