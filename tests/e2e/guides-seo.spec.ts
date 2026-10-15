import { expect, test } from "@playwright/test";

test("guides list links to an article with a working table of contents", async ({ page }) => {
  await page.goto("/guides");
  await page.getByRole("link", { name: "How to budget for your first international trip" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to budget for your first international trip");
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "Add daily spending" })
    .click();
  await expect(page).toHaveURL(/#add-daily-spending$/);
  await expect(page.getByText("General guidance only.")).toBeVisible();
});

test("sitemap lists published pages and robots blocks private areas", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of [
    "/destinations/zanzibar",
    "/packages/zanzibar-stone-town-and-beach-7-days",
    "/guides/beach-holiday-packing-checklist",
    "/consultations/trip-planning-call",
  ]) {
    expect(sitemap).toContain(path);
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/admin/);
  expect(robots).toMatch(/Disallow: \/account/);
});

test("filtered listing pages are noindex with a canonical to the base listing", async ({ page }) => {
  await page.goto("/destinations?region=africa&month=12");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/destinations$/);
});
