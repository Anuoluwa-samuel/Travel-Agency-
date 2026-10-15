/**
 * Typed application errors. Services throw these; server actions and route handlers translate
 * them into user-facing messages and HTTP codes. Anything else is an unexpected 500.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "INTEGRATION_NOT_CONFIGURED"
  | "INTEGRATION_FAILED";

const httpStatus: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  // Resource access failures for things the caller doesn't own also use 404, so existence
  // isn't leaked (IDOR protection).
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  INTEGRATION_NOT_CONFIGURED: 503,
  INTEGRATION_FAILED: 502,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Safe to show to the end user. */
  readonly publicMessage: string;
  readonly details?: Record<string, unknown>;

  constructor(code: AppErrorCode, publicMessage: string, details?: Record<string, unknown>) {
    super(publicMessage);
    this.name = "AppError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.details = details;
  }

  get status() {
    return httpStatus[this.code];
  }
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in to continue.");
export const forbidden = () => new AppError("FORBIDDEN", "You don't have permission to do that.");
export const notFound = (what = "That item") => new AppError("NOT_FOUND", `${what} could not be found.`);

export class IntegrationNotConfiguredError extends AppError {
  constructor(integration: string) {
    super("INTEGRATION_NOT_CONFIGURED", "This service isn't available online yet. Our team can help you directly.", {
      integration,
    });
    this.name = "IntegrationNotConfiguredError";
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
