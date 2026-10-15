import { type Page, expect } from "@playwright/test";
import postgres from "postgres";

/** Direct DB access for asserting server-side effects (read-only use in tests). */
export function e2eDb() {
  return postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} });
}

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@orbis.example`;

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Wait until the session cookie is set and we've left the sign-in page.
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export async function expectNoHorizontalScroll(page: Page) {
  const { doc, win } = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  expect(doc).toBeLessThanOrEqual(win);
}
