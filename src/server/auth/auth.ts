import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { brand } from "@/config/brand";
import { uuidv7 } from "@/lib/uuid";
import { db } from "@/server/db/client";
import { accounts, authRateLimits, sessions, twoFactors, users, verifications } from "@/server/db/schema";
import { env } from "@/server/env";
import { getEmailProvider } from "@/server/integrations/email";
import { logger } from "@/server/lib/logger";
import { resetPasswordEmail, verificationEmail } from "./emails";

/**
 * Better Auth instance (ADR-006). Database sessions in Postgres; email + password with
 * mandatory verification; TOTP two-factor available to everyone and enforced for privileged
 * staff roles by `requireStaff` (see ./session.ts).
 */
export const auth = betterAuth({
  appName: brand.name,
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
      rateLimit: authRateLimits,
    },
  }),
  advanced: {
    database: { generateId: () => uuidv7() },
    // Secure cookies whenever the app is served over HTTPS (staging and production).
    useSecureCookies: (env.BETTER_AUTH_URL ?? env.APP_URL).startsWith("https://"),
    cookiePrefix: "orbis",
  },
  user: {
    // Columns the auth library may not set from user input.
    additionalFields: {
      status: { type: "string", input: false, required: false, defaultValue: "active" },
      locale: { type: "string", input: false, required: false, defaultValue: "en-NG" },
      timezone: { type: "string", input: false, required: false, defaultValue: "Africa/Lagos" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh daily while active
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    async sendResetPassword({ user, url }) {
      const msg = resetPasswordEmail(url);
      await getEmailProvider().send({ to: user.email, ...msg });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    async sendVerificationEmail({ user, url }) {
      const msg = verificationEmail(url);
      await getEmailProvider().send({ to: user.email, ...msg });
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
    },
  },
  plugins: [twoFactor({ issuer: brand.name }), nextCookies()],
  logger: {
    log(level, message) {
      logger[level]({ source: "better-auth" }, message);
    },
  },
});

export type Auth = typeof auth;
