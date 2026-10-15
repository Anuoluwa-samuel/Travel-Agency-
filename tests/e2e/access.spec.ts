import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test("signed-out visitors are sent to sign-in for private areas", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin/);
});

test("customers can use their account but never see the admin area", async ({ page }) => {
  await signIn(page, "traveller@orbis.example");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: /Hello, Demo/ })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "We couldn’t find that page" })).toBeVisible();
});

test("a booking agent sees only their permitted admin sections", async ({ page }) => {
  await signIn(page, "booking-agent@orbis.example");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByText("Booking agent", { exact: true })).toBeVisible();
  await expect(page.getByText("finance.refund")).toHaveCount(0);
});

test("privileged staff must enable two-factor before entering admin", async ({ page }) => {
  await signIn(page, "finance-officer@orbis.example");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/security\?required=2fa/);
  await expect(page.getByText("Two-factor is required for your staff role")).toBeVisible();
});
