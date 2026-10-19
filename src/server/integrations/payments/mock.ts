import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { desc, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { webhookEvents } from "@/server/db/schema";
import { env } from "@/server/env";
import type { PaymentProvider, VerifiedCharge } from "./types";

/*
 * SIMULATED payment provider for development and automated tests only (RULES.md §1.4).
 * Never selected when APP_ENV=production. No money moves.
 *
 * The simulated checkout (/dev/mock-checkout) produces signed `charge.success` events and feeds
 * them through the same webhook processing as Paystack, so the real recording, ledger and
 * idempotency code paths are exercised. `verify` reads back what the simulated checkout recorded.
 */

const mockSecret = () => createHmac("sha256", env.BETTER_AUTH_SECRET).update("orbis-mock-payments").digest("hex");

export function signMockPayload(rawBody: string): string {
  return createHmac("sha512", mockSecret()).update(rawBody).digest("hex");
}

export function buildMockChargeEvent(input: {
  reference: string;
  amountMinor: bigint;
  currency: string;
  outcome: "success" | "failed";
  eventId?: string;
}) {
  const id = input.eventId ?? `mock_${input.reference}_${input.outcome}`;
  const body = JSON.stringify({
    event: input.outcome === "success" ? "charge.success" : "charge.failed",
    data: {
      id,
      status: input.outcome,
      reference: input.reference,
      amount: input.amountMinor.toString(),
      currency: input.currency,
      paid_at: input.outcome === "success" ? new Date().toISOString() : null,
      channel: "simulated",
    },
  });
  return { body, signature: signMockPayload(body) };
}

function toCharge(d: {
  id: string;
  status: string;
  reference: string;
  amount: string;
  currency: string;
  paid_at: string | null;
  channel: string;
}): VerifiedCharge {
  return {
    reference: d.reference,
    status: d.status === "success" ? "success" : "failed",
    amountMinor: BigInt(d.amount),
    currency: d.currency,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    channel: d.channel,
    providerTransactionId: d.id,
    safePayload: { ...d, simulated: true },
  };
}

export const mockPaymentProvider: PaymentProvider = {
  key: "mock",
  simulated: true,
  capabilities: { initialize: true, verify: true, webhook: true, refund: true },

  async initialize(input) {
    const url = new URL("/dev/mock-checkout", env.APP_URL);
    url.searchParams.set("reference", input.reference);
    return { checkoutUrl: url.toString(), accessCode: null };
  },

  async verify(reference) {
    const [evt] = await db
      .select({ payload: webhookEvents.payload })
      .from(webhookEvents)
      .where(
        sql`${webhookEvents.provider} = 'mock' AND ${webhookEvents.payload} -> 'data' ->> 'reference' = ${reference}`,
      )
      .orderBy(desc(webhookEvents.receivedAt))
      .limit(1);
    const data = (evt?.payload as { data?: Parameters<typeof toCharge>[0] } | undefined)?.data;
    return data ? toCharge(data) : null;
  },

  parseWebhook(rawBody, headers) {
    const sig = headers.get("x-mock-signature") ?? "";
    const expected = signMockPayload(rawBody);
    const signatureValid =
      /^[0-9a-f]{128}$/.test(sig) && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    const event = JSON.parse(rawBody) as { event: string; data: Parameters<typeof toCharge>[0] };
    const charge = event.event.startsWith("charge.") ? toCharge(event.data) : null;
    return {
      signatureValid,
      eventId: `${event.event}:${event.data.id}`,
      eventType: event.event,
      charge,
      safePayload: { event: event.event, data: { ...event.data, simulated: true } },
    };
  },

  async refund(input) {
    return { providerReference: `mock_refund_${input.reference}`, status: "processed" };
  },
};
