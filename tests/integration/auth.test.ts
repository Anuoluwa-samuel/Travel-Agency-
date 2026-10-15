import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Exercises Better Auth and our staff gate against the real test database. `next/headers` is
 * replaced with a per-test cookie jar because these calls run outside a Next.js request.
 */
let currentHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentHeaders,
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [], has: () => false }),
}));

const { auth } = await import("@/server/auth/auth");
const { requireStaff, requireUser, TwoFactorRequiredError } = await import("@/server/auth/session");
const { seed } = await import("@/server/db/seed");

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const PASSWORD = process.env.SEED_DEMO_PASSWORD!;

async function signInAs(email: string, password = PASSWORD) {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: res.status, cookie };
}

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
  // Rate limiting is covered separately; keep it from interfering with repeated sign-ins here.
  await sql`delete from auth_rate_limits`;
});

beforeEach(() => {
  currentHeaders = new Headers();
});

afterAll(async () => {
  await sql.end();
});

describe("email + password", () => {
  it("requires email verification before sign-in", async () => {
    const email = `new-${Date.now()}@orbis.example`;
    await auth.api.signUpEmail({ body: { name: "New Person", email, password: "a-strong-password-1" } });
    const { status } = await signInAs(email, "a-strong-password-1");
    expect(status).toBe(403);

    await sql`update users set email_verified = true where lower(email) = ${email}`;
    const ok = await signInAs(email, "a-strong-password-1");
    expect(ok.status).toBe(200);
  });

  it("stores a hash, never the plaintext password", async () => {
    const [row] =
      await sql`select a.password from accounts a join users u on u.id = a.user_id where u.email = 'traveller@orbis.example'`;
    expect(row.password).not.toContain(PASSWORD);
    expect(row.password.length).toBeGreaterThan(40);
  });

  it("rejects a wrong password", async () => {
    const { status } = await signInAs("traveller@orbis.example", "wrong-password-123");
    expect(status).toBe(401);
  });
});

describe("staff gate", () => {
  it("returns no user without a session", async () => {
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("forbids customers from the admin area", async () => {
    const { cookie } = await signInAs("traveller@orbis.example");
    currentHeaders = new Headers({ cookie });
    await expect(requireUser()).resolves.toMatchObject({ email: "traveller@orbis.example" });
    await expect(requireStaff()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a booking agent in but blocks finance actions", async () => {
    const { cookie } = await signInAs("booking-agent@orbis.example");
    currentHeaders = new Headers({ cookie });
    const ctx = await requireStaff("booking.read");
    expect(ctx.roles).toEqual(["booking_agent"]);
    await expect(requireStaff("finance.refund")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires two-factor for privileged roles", async () => {
    const { cookie } = await signInAs("finance-officer@orbis.example");
    currentHeaders = new Headers({ cookie });
    await expect(requireStaff()).rejects.toBeInstanceOf(TwoFactorRequiredError);

    await sql`update users set two_factor_enabled = true where email = 'finance-officer@orbis.example'`;
    const ctx = await requireStaff("finance.refund");
    expect(ctx.permissions.has("finance.refund")).toBe(true);
    await sql`update users set two_factor_enabled = false where email = 'finance-officer@orbis.example'`;
  });

  it("drops access when a staff profile is deactivated", async () => {
    await sql`update staff_profiles sp set is_active = false from users u where u.id = sp.user_id and u.email = 'support-agent@orbis.example'`;
    const { cookie } = await signInAs("support-agent@orbis.example");
    currentHeaders = new Headers({ cookie });
    await expect(requireStaff()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
