export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Provider-side idempotency key; prevents duplicate sends on retry. */
  idempotencyKey?: string;
}

export interface EmailSendResult {
  provider: string;
  providerMessageId: string | null;
  /** False for the development console adapter: nothing left this machine. */
  delivered: boolean;
}

export interface EmailProvider {
  readonly key: string;
  readonly simulated: boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
