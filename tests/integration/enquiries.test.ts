import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, updateTag: () => {} }));

const { enquirySchema } = await import("@/lib/validation/enquiry");
const { createEnquiry } = await import("@/server/services/enquiries/create");
const { consumeRateLimit } = await import("@/server/lib/rate-limit");
const { seed } = await import("@/server/db/seed");

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

const input = (over: Record<string, unknown> = {}) =>
  enquirySchema.parse({
    category: "package",
    name: "Test Traveller",
    email: `t-${Math.random().toString(36).slice(2)}@orbis.example`,
    message: "Two adults, flexible on dates in December.",
    packageSlug: "zanzibar-stone-town-and-beach-7-days",
    budget: "3,500,000",
    ...over,
  });

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
});
afterAll(async () => {
  await sql.end();
});

describe("createEnquiry", () => {
  it("stores the enquiry with a reference, the first message and resolved catalogue links", async () => {
    const res = await createEnquiry(input(), { customerUserId: null, idempotencyKey: crypto.randomUUID() });
    expect(res.reference).toMatch(/^EQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(res.duplicate).toBe(false);

    const [row] = await sql`
      select e.*, p.slug as package_slug, d.slug as destination_slug,
             (select count(*)::int from enquiry_messages m where m.enquiry_id = e.id) as messages
      from enquiries e
      left join packages p on p.id = e.package_id
      left join destinations d on d.id = e.destination_id
      where e.reference = ${res.reference}`;
    expect(row.status).toBe("new");
    expect(row.package_slug).toBe("zanzibar-stone-town-and-beach-7-days");
    expect(row.destination_slug).toBe("zanzibar"); // inferred from the package
    expect(BigInt(row.budget_minor)).toBe(350_000_000n);
    expect(row.budget_currency).toBe("NGN");
    expect(row.messages).toBe(1);
  });

  it("does not claim the acknowledgement was sent when only the dev console adapter ran", async () => {
    const res = await createEnquiry(input(), { customerUserId: null });
    expect(res.acknowledgementSent).toBe(false);
    const [row] = await sql`select acknowledgement_sent_at from enquiries where reference = ${res.reference}`;
    expect(row.acknowledgement_sent_at).toBeNull();
  });

  it("returns the same reference for a repeated client key (double submit)", async () => {
    const key = crypto.randomUUID();
    const v = input();
    const a = await createEnquiry(v, { customerUserId: null, idempotencyKey: key });
    const b = await createEnquiry(v, { customerUserId: null, idempotencyKey: key });
    expect(b).toMatchObject({ reference: a.reference, duplicate: true });
  });

  it("dedupes identical content without a client key within the window", async () => {
    const v = input();
    const now = new Date("2026-10-15T10:01:00Z");
    const a = await createEnquiry(v, { customerUserId: null, now });
    const b = await createEnquiry(v, { customerUserId: null, now: new Date("2026-10-15T10:05:00Z") });
    expect(b.reference).toBe(a.reference);
  });

  it("handles concurrent identical submissions without creating two enquiries", async () => {
    const key = crypto.randomUUID();
    const v = input();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createEnquiry(v, { customerUserId: null, idempotencyKey: key })),
    );
    expect(new Set(results.map((r) => r.reference)).size).toBe(1);
    const [{ n }] = await sql`select count(*)::int n from enquiries where idempotency_key = ${`client:${key}`}`;
    expect(n).toBe(1);
  });

  it("ignores unknown or unpublished catalogue slugs", async () => {
    const res = await createEnquiry(input({ packageSlug: "does-not-exist", destinationSlug: "nowhere" }), {
      customerUserId: null,
    });
    const [row] = await sql`select package_id, destination_id from enquiries where reference = ${res.reference}`;
    expect(row).toEqual({ package_id: null, destination_id: null });
  });
});

describe("consumeRateLimit", () => {
  it("allows up to the limit within a window, then blocks", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await consumeRateLimit(key, 3, 60)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });
});
