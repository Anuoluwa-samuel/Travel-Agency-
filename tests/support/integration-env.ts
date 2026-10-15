import { config } from "dotenv";

/**
 * Point every server module at the throwaway test database before anything imports env.ts.
 * Secrets here are test-only constants, never real credentials.
 */
config({ path: ".env.local", quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
if (testUrl === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");

Object.assign(process.env, {
  NODE_ENV: "test",
  APP_ENV: "test",
  DATABASE_URL: testUrl,
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  RESEND_API_KEY: "",
  LOG_LEVEL: "error",
});

// Fixed demo password for seeded accounts in the test DB (never written to .env.local).
process.env.SEED_DEMO_PASSWORD = "integration-test-password";
