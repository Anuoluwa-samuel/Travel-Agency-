import "server-only";
import { env } from "@/server/env";
import { consoleEmailProvider } from "./console";
import { createResendProvider } from "./resend";
import type { EmailProvider } from "./types";

export type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * Resolves the configured email provider. Production refuses to start without Resend
 * (validated in env.ts), so the console adapter can only ever run in development and tests.
 */
export function getEmailProvider(): EmailProvider {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return createResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  return consoleEmailProvider;
}
