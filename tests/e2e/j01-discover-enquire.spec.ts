import { expect, test } from "@playwright/test";
import { e2eDb, uniqueEmail } from "./support";

// J01: a visitor discovers a destination and submits an enquiry.
test("visitor searches, opens a destination and sends an enquiry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search destinations" }).fill("zanzibar");
  await page.getByRole("button", { name: "Explore" }).click();

  await expect(page).toHaveURL(/\/destinations\?q=zanzibar/);
  await expect(page.getByRole("heading", { name: /^1 destination\b/ })).toBeVisible();
  await page.getByRole("link", { name: "Zanzibar", exact: true }).click();

  await expect(page).toHaveURL(/\/destinations\/zanzibar$/);
  await expect(page.getByText("Entry and documents")).toBeVisible();
  // No unsourced visa rules are shown.
  await expect(page.getByText("We only publish entry requirements once")).toBeVisible();
  await page.getByRole("link", { name: "Start planning" }).click();

  await expect(page.getByText("About: Zanzibar")).toBeVisible();
  const email = uniqueEmail("j01");
  await page.getByLabel("Full name").fill("Journey One");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Tell us more").fill("Two adults, a week in December, beach and Stone Town.");
  await page.getByRole("button", { name: "Send enquiry" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Your reference is");
  await expect(status).toContainText("This is an enquiry, not a booking");
  const reference = (await status.locator("strong").first().textContent())!.trim();
  expect(reference).toMatch(/^EQ-[0-9A-Z]{4}-[0-9A-Z]{4}$/);

  const sql = e2eDb();
  const [row] = await sql`
    select e.category, e.status, d.slug from enquiries e left join destinations d on d.id = e.destination_id
    where e.reference = ${reference} and e.contact_email = ${email}`;
  await sql.end();
  expect(row).toEqual({ category: "custom_trip", status: "new", slug: "zanzibar" });
});

test("enquiry form keeps input and shows errors when validation fails", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Full name").fill("Kept Name");
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByText("Please check the highlighted fields.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Kept Name");
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
});
