import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

/*
 * End-to-end journeys (docs/journeys.md). Runs against its own database, `orbis_e2e`, which is
 * reset, migrated and seeded before every run, and a server on port 3210 (override with E2E_PORT) pointed at it.
 * External services stay unconfigured, so no real email, payment or supplier call is made.
 */
config({ path: ".env.local", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;
const baseDb = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL?.replace(/\/[^/?]+(\?.*)?$/, "/orbis_e2e$1");
if (!baseDb) throw new Error("Set E2E_DATABASE_URL or DATABASE_URL");
process.env.E2E_DATABASE_URL = baseDb;
// One random password per run for the seeded demo accounts; never written to disk.
process.env.E2E_SEED_PASSWORD ??= randomBytes(18).toString("base64url");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    // CI runs the production build; locally the dev server is faster to start.
    command: `pnpm exec tsx tests/e2e/prepare-db.ts && ${process.env.CI ? "pnpm start" : "pnpm dev"} --port ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: baseDb,
      APP_URL: BASE_URL,
      BETTER_AUTH_URL: BASE_URL,
      APP_ENV: "test",
      RESEND_API_KEY: "",
      LOG_LEVEL: "warn",
      E2E_DATABASE_URL: baseDb,
      E2E_SEED_PASSWORD: process.env.E2E_SEED_PASSWORD!,
    },
  },
});
