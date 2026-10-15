import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./support";

const pages = [
  "/",
  "/destinations",
  "/destinations/zanzibar",
  "/packages/zanzibar-stone-town-and-beach-7-days",
  "/contact",
  "/consultations/trip-planning-call",
  "/guides/beach-holiday-packing-checklist",
];

for (const path of pages) {
  test(`no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
  });
}

test("mobile menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Packages" }).click();
  await expect(page).toHaveURL(/\/packages$/);
});

test("destination filters start collapsed on phones", async ({ page }) => {
  await page.goto("/destinations");
  await expect(page.getByLabel("Region")).toBeHidden();
  await page.getByText("Filters", { exact: true }).click();
  await expect(page.getByLabel("Region")).toBeVisible();
});
