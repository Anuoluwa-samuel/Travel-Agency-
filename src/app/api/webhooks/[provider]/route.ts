import { handlePaymentWebhook } from "@/server/services/payments/service";

/**
 * Payment provider webhooks: POST /api/webhooks/paystack (and /mock in development).
 * The raw body is read as text because the signature is computed over the exact bytes.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/webhooks/[provider]">) {
  const { provider } = await params;
  const raw = await request.text();
  if (raw.length > 256_000) return new Response(null, { status: 413 });
  const result = await handlePaymentWebhook(provider, raw, request.headers);
  return new Response(null, { status: result.status });
}
