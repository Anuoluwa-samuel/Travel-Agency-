import "server-only";
import pino from "pino";

/**
 * Structured logger with personal-data redaction (RULES.md §4). Paths cover the shapes we log:
 * request bodies, traveller records, payment payloads and auth material. When in doubt, log an
 * id instead of the object.
 */
export const REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "*.tokenHash",
  "secret",
  "*.secret",
  "authorization",
  "*.authorization",
  "headers.cookie",
  "*.headers.cookie",
  "cookie",
  "*.passportNumber",
  "*.passport_number",
  "*.dateOfBirth",
  "*.dob",
  "*.cardNumber",
  "*.cvv",
  "*.authorization_code",
  "*.phone",
  "*.address",
  "*.email",
  "email",
  "phone",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "orbis" },
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
