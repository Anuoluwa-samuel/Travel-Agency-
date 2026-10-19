/**
 * Payment provider port (ARCHITECTURE §9). Adapters declare what they can do; callers check
 * `capabilities` and never assume. Amounts are always integer minor units.
 */
export interface InitializeInput {
  reference: string;
  amountMinor: bigint;
  currency: string;
  email: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface InitializeResult {
  checkoutUrl: string;
  accessCode: string | null;
}

export interface VerifiedCharge {
  /** Our payment attempt reference, echoed by the provider. */
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending";
  amountMinor: bigint;
  currency: string;
  paidAt: Date | null;
  channel: string | null;
  providerTransactionId: string | null;
  /** Payload with customer and card details removed, safe to store. */
  safePayload: Record<string, unknown>;
}

export interface ParsedWebhook {
  signatureValid: boolean;
  eventId: string;
  eventType: string;
  /** Set for charge events. */
  charge: VerifiedCharge | null;
  safePayload: Record<string, unknown>;
}

export interface RefundResult {
  providerReference: string;
  status: "pending" | "processed" | "failed";
}

export interface PaymentProvider {
  readonly key: "paystack" | "mock";
  readonly simulated: boolean;
  readonly capabilities: { initialize: true; verify: true; webhook: true; refund: boolean };
  initialize(input: InitializeInput): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifiedCharge | null>;
  parseWebhook(rawBody: string, headers: Headers): ParsedWebhook;
  refund?(input: { reference: string; amountMinor: bigint; currency: string; note: string }): Promise<RefundResult>;
}
