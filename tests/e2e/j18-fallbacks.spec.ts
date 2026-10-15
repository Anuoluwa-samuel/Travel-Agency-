import { expect, test } from "@playwright/test";

// J18: an unconfigured integration produces an honest fallback, never fake results.
test("flights page explains search isn't live and offers a consultant", async ({ page }) => {
  await page.goto("/flights");
  await expect(page.getByRole("note")).toContainText("Instant online search isn’t available yet");
  await expect(page.getByLabel("What can we help with?")).toHaveValue("flight");
  await expect(page.getByText(/simulated/i)).toHaveCount(0);
});

test("unknown pages return a helpful 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn’t find that page" })).toBeVisible();
});

test("missing catalogue items are not indexable", async ({ page }) => {
  await page.goto("/destinations/not-a-real-place");
  await expect(page.getByRole("heading", { name: "We couldn’t find that page" })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
});
