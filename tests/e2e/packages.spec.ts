import { expect, test } from "@playwright/test";

// J02 (first half): browse a package and start a request. Online checkout arrives in Phase 4.
test("package page shows structured itinerary, prices and a request route", async ({ page }) => {
  await page.goto("/packages");
  await page.getByRole("link", { name: "Zanzibar: Stone Town & North Coast" }).click();

  await expect(page.getByRole("heading", { name: "Day by day" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Day 7/ })).toBeAttached();
  const dates = page.getByRole("table", { name: /Upcoming departures/ });
  await expect(dates.getByRole("row")).toHaveCount(3); // header + 2 departures
  await expect(dates).toContainText("₦1,650,000");
  await expect(page.getByText("Confirmed when quoted").first()).toBeVisible();
  // Exact seat counts are never shown.
  await expect(page.getByText(/\d+ seats? left/i)).toHaveCount(0);

  await page.getByRole("link", { name: "Request to book" }).click();
  await expect(page).toHaveURL(/\/contact\?category=package&package=zanzibar-stone-town-and-beach-7-days/);
  await expect(page.getByText("About: Zanzibar: Stone Town & North Coast")).toBeVisible();
  await expect(page.getByLabel("What can we help with?")).toHaveValue("package");
});

test("destination filters narrow results and can be reset", async ({ page }) => {
  await page.goto("/destinations?region=europe");
  await expect(page.getByText("1 destination match your filters")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lisbon", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Reset" }).click();
  await expect(page.getByText("6 destinations")).toBeVisible();
});
