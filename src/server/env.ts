import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at first import. Missing launch-critical values fail fast
 * with a readable message; optional integrations resolve to "not configured" and their adapters
 * fall back honestly (docs/integrations.md).
 *
 * Never import this from client components. Public values must use NEXT_PUBLIC_ and live in
 * `src/config/public-env.ts`.
 */

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /**
     * Deployment tier. Separate from NODE_ENV because `next build` always sets
     * NODE_ENV=production, including local builds. Production-only requirements key off this.
     */
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.url().optional(),

    /** 32 random bytes, base64. Encrypts passport numbers and dates of birth. */
    DATA_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded"),

    // Payments
    PAYSTACK_SECRET_KEY: optional,
    PAYSTACK_PUBLIC_KEY: optional,

    // Email
    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,

    // Storage
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    S3_ENDPOINT: optional,
    S3_REGION: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_PRIVATE_BUCKET: optional,
    S3_PUBLIC_BUCKET: optional,

    // AI
    ANTHROPIC_API_KEY: optional,
    AI_MODEL: z.string().default("claude-sonnet-5-5"),

    // Jobs / cron
    CRON_SECRET: optional,

    // Observability
    SENTRY_DSN: optional,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;
    // Production must not run on local storage or without transactional email.
    if (env.STORAGE_DRIVER !== "s3") {
      ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "Production requires STORAGE_DRIVER=s3" });
    }
    for (const key of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PRIVATE_BUCKET"] as const) {
      if (env.STORAGE_DRIVER === "s3" && !env[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Production requires RESEND_API_KEY and EMAIL_FROM",
      });
    }
  });

export type ServerEnv = z.infer<typeof schema>;

function load(): ServerEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment configuration:\n${details}\nSee .env.example.`);
  }
  return parsed.data;
}

export const env = load();

export const isProduction = env.APP_ENV === "production";

/** Which optional integrations have credentials. Used by adapters and the admin settings page. */
export const integrations = {
  paystack: Boolean(env.PAYSTACK_SECRET_KEY && env.PAYSTACK_PUBLIC_KEY),
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  s3: env.STORAGE_DRIVER === "s3",
  ai: Boolean(env.ANTHROPIC_API_KEY),
} as const;
