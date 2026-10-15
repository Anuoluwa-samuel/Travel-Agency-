import { expect, test } from "@playwright/test";
import { e2eDb, uniqueEmail } from "./support";

test("visitor books a consultation slot", async ({ page }) => {
  await page.goto("/consultations");
  await page.getByRole("link", { name: "Choose a time" }).first().click();
  await expect(page.getByRole("heading", { name: "Trip planning call" })).toBeVisible();

  const firstTime = page
    .getByRole("list", { name: /Times on/ })
    .getByRole("link")
    .first();
  const label = (await firstTime.textContent())!.trim().slice(0, 5);
  await firstTime.click();
  await expect(page.getByText(`${label} WAT`)).toBeVisible();

  const email = uniqueEmail("consult");
  await page.getByLabel("Full name").fill("Consult Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Confirm booking" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("You’re booked");
  const reference = (await status.locator("strong.font-mono").textContent())!.trim();
  expect(reference).toMatch(/^CN-/);

  const sql = e2eDb();
  const [row] =
    await sql`select status, format from consultations where reference = ${reference} and contact_email = ${email}`;
  await sql.end();
  expect(row).toEqual({ status: "confirmed", format: "video" });
});

test("phone consultations require a phone number", async ({ page }) => {
  await page.goto("/consultations/trip-planning-call");
  await page
    .getByRole("list", { name: /Times on/ })
    .getByRole("link")
    .nth(1)
    .click();
  await page.getByRole("radio", { name: "Phone call" }).check();
  await page.getByLabel("Full name").fill("No Phone");
  await page.getByLabel("Email").fill(uniqueEmail("nophone"));
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Add a number for the phone call")).toBeVisible();
});
