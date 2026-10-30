import "server-only";
import { env, isProduction } from "@/server/env";
import { IntegrationNotConfiguredError } from "@/server/lib/errors";
import { mockPaymentProvider } from "./mock";
import { createPaystackProvider } from "./paystack";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, VerifiedCharge, ParsedWebhook } from "./types";

/**
 * Paystack when keys are configured. Otherwise the simulated provider in development and tests,
 * and nothing at all in production: online payment is reported as unavailable instead of faked.
 */
export function getPaymentProvider(): PaymentProvider {
  if (env.PAYSTACK_SECRET_KEY) return createPaystackProvider(env.PAYSTACK_SECRET_KEY);
  if (!isProduction) return mockPaymentProvider;
  throw new IntegrationNotConfiguredError("paystack");
}

export function getProviderByKey(key: string): PaymentProvider | null {
  if (key === "paystack" && env.PAYSTACK_SECRET_KEY) return createPaystackProvider(env.PAYSTACK_SECRET_KEY);
  if (key === "mock" && !isProduction) return mockPaymentProvider;
  return null;
}

export function onlinePaymentsAvailable(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY) || !isProduction;
}
