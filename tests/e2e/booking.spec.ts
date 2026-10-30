import { createHmac } from "node:crypto";
import { type Page, expect, test } from "@playwright/test";
import { e2eDb, uniqueEmail } from "./support";

/*
 * Booking and payment journeys (J02, J04, J05, J17). Payments use the simulated provider: no
 * money moves, and the simulated checkout feeds the real webhook handler.
 */

const CAPE = "/packages/cape-town-city-and-winelands-5-days/book";
const ZANZIBAR = "/packages/zanzibar-stone-town-and-beach-7-days/book";

async function bookTwoAdults(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByRole("button", { name: "See price" }).click();
  await expect(page.getByRole("heading", { name: "Your price" })).toBeVisible();

  const first = page.getByLabel("First name (as on passport)");
  const last = page.getByLabel("Last name (as on passport)");
  await first.nth(0).fill("Ada");
  await last.nth(0).fill("Journey");
  await page.getByLabel("Passport number (optional now)").nth(0).fill("C12345678");
  await first.nth(1).fill("Tunde");
  await last.nth(1).fill("Journey");
  await page.getByLabel("Full name").fill("Ada Journey");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("+234 800 000 0000");
}

async function submitBooking(page: Page, button: string) {
  await page.getByLabel("I’ve read the cancellation terms above and agree to them.").check();
  await page.getByRole("button", { name: button }).click();
  await expect(page).toHaveURL(/\/bookings\/BK-[0-9A-Z]{4}-[0-9A-Z]{4}\?new=1$/);
  return /\/bookings\/(BK-[0-9A-Z-]+)/.exec(page.url())![1];
}

test("instant booking: price, travellers, deposit via simulated checkout, receipt (J02, J05)", async ({ page }) => {
  const email = uniqueEmail("instant");
  await bookTwoAdults(page, CAPE, email);

  // Terms must be accepted.
  await page.getByRole("button", { name: "Book and continue to payment" }).click();
  await expect(page.getByText("Please accept the booking terms to continue")).toBeVisible();

  const ref = await submitBooking(page, "Book and continue to payment");
  await expect(page.getByText("Booking created")).toBeVisible();
  await expect(page.getByText("Payment required", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Pay deposit/ }).click();
  await expect(page).toHaveURL(/\/dev\/mock-checkout\?reference=PY-/);
  await expect(page.getByText("Simulated data")).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();

  await expect(page).toHaveURL(new RegExp(`/bookings/${ref}\\?payment=paid$`));
  await expect(page.getByText("Payment received. Thank you!")).toBeVisible();
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay balance/ })).toBeVisible();

  const sql = e2eDb();
  const [b] =
    await sql`select status, paid_minor, deposit_minor, balance_minor, total_minor from bookings where reference = ${ref}`;
  const [{ ledger }] =
    await sql`select sum(amount_minor)::bigint ledger from ledger_entries l join bookings b on b.id = l.booking_id where b.reference = ${ref}`;
  const [lead] =
    await sql`select passport_number_enc from booking_travellers t join bookings b on b.id = t.booking_id where b.reference = ${ref} and t.is_lead = 1`;
  await sql.end();
  expect(b.status).toBe("confirmed");
  expect(BigInt(b.paid_minor)).toBe(BigInt(b.deposit_minor));
  expect(BigInt(ledger)).toBe(BigInt(b.balance_minor));
  expect(lead.passport_number_enc).not.toContain("C12345678");

  await page.getByRole("link", { name: "View receipt" }).click();
  await expect(page.getByRole("heading", { name: /^Invoice IN-/ })).toBeVisible();
  await expect(page.getByText("Balance due", { exact: true })).toBeVisible();
});

test("a failed simulated payment leaves the booking unpaid", async ({ page }) => {
  await bookTwoAdults(page, CAPE, uniqueEmail("failed"));
  const ref = await submitBooking(page, "Book and continue to payment");
  await page.getByRole("button", { name: /^Pay deposit/ }).click();
  await page.getByRole("button", { name: "Simulate failed payment" }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/${ref}\\?payment=failed$`));
  await expect(page.getByText(/The payment didn.t go through/)).toBeVisible();
  await expect(page.getByText("Payment required", { exact: true })).toBeVisible();
});

test("request to book: no payment until staff confirm", async ({ page }) => {
  await bookTwoAdults(page, ZANZIBAR, uniqueEmail("request"));
  await submitBooking(page, "Send booking request");
  await expect(page.getByText("Request received").first()).toBeVisible();
  await expect(page.getByText("Nothing has been charged.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
});

test("cancellation request shows the policy charge first (J17)", async ({ page }) => {
  await bookTwoAdults(page, CAPE, uniqueEmail("cancel"));
  await submitBooking(page, "Book and continue to payment");
  await page.getByText("Cancel this booking").click();
  await expect(page.getByText(/If you cancel today \(\d+ days before departure\), the charge is/)).toBeVisible();
  await page.getByLabel("Why are you cancelling?").fill("Plans changed");
  await page.getByLabel("I understand the cancellation charges shown above.").check();
  await page.getByRole("button", { name: "Request cancellation" }).click();
  await expect(page.getByText("Cancellation requested. Our team will confirm by email.")).toBeVisible();
  await expect(page.getByText("Cancellation requested", { exact: true }).first()).toBeVisible();
});

test("a guest can only open a booking after proving the email with a code (J04)", async ({ page, browser }) => {
  const email = uniqueEmail("guest");
  await bookTwoAdults(page, CAPE, email);
  const ref = await submitBooking(page, "Book and continue to payment");

  // A different browser has no access from the reference alone.
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await other.goto(`/bookings/${ref}`);
  await expect(other.getByRole("heading", { name: "We couldn’t find that page" })).toBeVisible();

  await other.goto(`/booking/lookup?ref=${ref}`);
  await other.getByLabel("Email used for the booking").fill(email);
  await other.getByRole("button", { name: "Email me a code" }).click();
  await expect(other.getByText("Check your email")).toBeVisible();

  // The real code only exists in the (unsent) email, so the test issues a known code the same
  // way the server does: HMAC of booking id + code with the auth secret.
  const sql = e2eDb();
  const [b] = await sql`select id from bookings where reference = ${ref}`;
  const code = "482916";
  const hash = createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`guest-code:${b.id}:${code}`).digest("hex");
  await sql`insert into guest_access_codes (id, booking_id, code_hash, expires_at) values (gen_random_uuid(), ${b.id}, ${hash}, now() + interval '10 minutes')`;
  await sql.end();

  await other.getByLabel("6-digit code").fill("000000");
  await other.getByRole("button", { name: "View booking" }).click();
  await expect(other.getByText(/That code isn.t right or has expired/)).toBeVisible();

  await other.getByLabel("6-digit code").fill(code);
  await other.getByRole("button", { name: "View booking" }).click();
  await expect(other).toHaveURL(new RegExp(`/bookings/${ref}$`));
  await expect(other.getByText(`Booking ${ref}`)).toBeVisible();
  await stranger.close();
});
