import "server-only";
import { AppError } from "@/server/lib/errors";
import type { EmailProvider } from "./types";

/** Resend REST adapter (https://resend.com/docs/api-reference/emails/send-email). */
export function createResendProvider(apiKey: string, from: string): EmailProvider {
  return {
    key: "resend",
    simulated: false,
    async send(message) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new AppError("INTEGRATION_FAILED", "We couldn't send the email. Please try again shortly.", {
          provider: "resend",
          status: res.status,
        });
      }
      const body = (await res.json()) as { id?: string };
      return { provider: "resend", providerMessageId: body.id ?? null, delivered: true };
    },
  };
}
