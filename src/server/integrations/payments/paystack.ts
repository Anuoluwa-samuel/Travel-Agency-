import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/server/lib/errors";
import type { PaymentProvider, VerifiedCharge } from "./types";

/*
 * Paystack adapter. Behaviour checked against https://paystack.com/docs (2026-10-19):
 * - POST /transaction/initialize { email, amount (subunit, string), currency, reference,
 *   callback_url, metadata (stringified JSON) } → data.authorization_url / access_code
 * - GET /transaction/verify/:reference → data.status ("success" | "failed" | "abandoned" | …),
 *   data.amount (subunit), currency, paid_at, channel, id
 * - Webhooks: header `x-paystack-signature` = hex HMAC-SHA512 of the raw body with the secret key;
 *   unacknowledged events are retried for up to 72 hours, so processing must be idempotent.
 * - POST /refund { transaction (reference or id), amount (subunit, optional) }
 * References may contain only letters, digits, "-", "." and "=".
 */

const API = "https://api.paystack.co";

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature.toLowerCase(), "hex"));
}

interface PaystackTx {
  id: number | string;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  channel: string | null;
  gateway_response?: string;
}

/** Keeps the fields we need for reconciliation; drops customer, card and device details. */
function toCharge(d: PaystackTx): VerifiedCharge {
  const status =
    d.status === "success"
      ? "success"
      : d.status === "failed"
        ? "failed"
        : d.status === "abandoned"
          ? "abandoned"
          : "pending";
  return {
    reference: d.reference,
    status,
    amountMinor: BigInt(Math.round(Number(d.amount))),
    currency: d.currency,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    channel: d.channel ?? null,
    providerTransactionId: String(d.id),
    safePayload: {
      id: String(d.id),
      status: d.status,
      reference: d.reference,
      amount: d.amount,
      currency: d.currency,
      paid_at: d.paid_at,
      channel: d.channel,
      gateway_response: d.gateway_response ?? null,
    },
  };
}

export function createPaystackProvider(secretKey: string): PaymentProvider {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !body?.status) {
      throw new AppError("INTEGRATION_FAILED", "The payment provider didn't respond as expected. Please try again.", {
        provider: "paystack",
        httpStatus: res.status,
        message: body?.message ?? null,
      });
    }
    return body.data as T;
  }

  return {
    key: "paystack",
    simulated: false,
    capabilities: { initialize: true, verify: true, webhook: true, refund: true },

    async initialize(input) {
      const data = await call<{ authorization_url: string; access_code: string; reference: string }>(
        "/transaction/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            email: input.email,
            amount: input.amountMinor.toString(),
            currency: input.currency,
            reference: input.reference,
            callback_url: input.callbackUrl,
            metadata: JSON.stringify(input.metadata),
          }),
        },
      );
      return { checkoutUrl: data.authorization_url, accessCode: data.access_code };
    },

    async verify(reference) {
      try {
        const data = await call<PaystackTx>(`/transaction/verify/${encodeURIComponent(reference)}`);
        return toCharge(data);
      } catch (e) {
        // Unknown reference: treat as "not paid" rather than an outage.
        if (e instanceof AppError && e.details?.httpStatus === 400) return null;
        throw e;
      }
    },

    parseWebhook(rawBody, headers) {
      const signatureValid = verifyPaystackSignature(rawBody, headers.get("x-paystack-signature"), secretKey);
      let event: { event?: string; data?: PaystackTx & { id?: number | string } } = {};
      try {
        event = JSON.parse(rawBody);
      } catch {
        return { signatureValid: false, eventId: "invalid-json", eventType: "invalid", charge: null, safePayload: {} };
      }
      const type = event.event ?? "unknown";
      const charge = type === "charge.success" && event.data ? toCharge(event.data) : null;
      return {
        signatureValid,
        eventId: `${type}:${event.data?.id ?? event.data?.reference ?? "unknown"}`,
        eventType: type,
        charge,
        safePayload: charge ? { event: type, data: charge.safePayload } : { event: type },
      };
    },

    async refund(input) {
      const data = await call<{ id: number; status: string }>("/refund", {
        method: "POST",
        body: JSON.stringify({
          transaction: input.reference,
          amount: Number(input.amountMinor),
          merchant_note: input.note,
        }),
      });
      return {
        providerReference: String(data.id),
        status: data.status === "processed" ? "processed" : data.status === "failed" ? "failed" : "pending",
      };
    },
  };
}
