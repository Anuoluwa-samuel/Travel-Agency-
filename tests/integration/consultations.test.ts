import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, updateTag: () => {} }));

const { bookConsultation, getAvailability } = await import("@/server/services/consultations/service");
const { consultationBookingSchema } = await import("@/lib/validation/consultation");
const { seed } = await import("@/server/db/seed");

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
// A fixed Monday morning in Lagos so availability is deterministic.
const NOW = new Date("2026-11-02T07:00:00Z");

const input = (startsAt: string, over: Record<string, unknown> = {}) =>
  consultationBookingSchema.parse({
    serviceSlug: "trip-planning-call",
    startsAt,
    format: "video",
    name: "Test Caller",
    email: `c-${Math.random().toString(36).slice(2)}@orbis.example`,
    timezone: "Europe/London",
    ...over,
  });

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
  await sql`delete from consultations`;
});
afterAll(async () => {
  await sql.end();
});

describe("availability", () => {
  it("offers weekday slots from staff hours after the minimum notice", async () => {
    const a = await getAvailability("trip-planning-call", NOW, 7);
    expect(a).not.toBeNull();
    const starts = a!.slots.map((s) => s.startsAt.toISOString());
    expect(starts.length).toBeGreaterThan(0);
    // Nothing before now + 12h, nothing on the weekend (7–8 Nov).
    expect(a!.slots.every((s) => s.startsAt.getTime() >= NOW.getTime() + 12 * 3_600_000)).toBe(true);
    expect(starts.some((s) => s.startsWith("2026-11-07") || s.startsWith("2026-11-08"))).toBe(false);
  });

  it("returns null for unknown services", async () => {
    expect(await getAvailability("nope", NOW)).toBeNull();
  });
});

describe("bookConsultation", () => {
  it("books a free slot, stores the visitor timezone and removes the slot for that consultant", async () => {
    const before = await getAvailability("trip-planning-call", NOW, 7);
    const slot = before!.slots[0];
    const r = await bookConsultation(input(slot.startsAt.toISOString()), { customerUserId: null, now: NOW });
    expect(r.reference).toMatch(/^CN-/);
    const [row] =
      await sql`select status, customer_timezone, staff_id from consultations where reference = ${r.reference}`;
    expect(row).toMatchObject({ status: "confirmed", customer_timezone: "Europe/London" });
    expect(slot.staffIds).toContain(row.staff_id);

    const after = await getAvailability("trip-planning-call", NOW, 7);
    const same = after!.slots.find((s) => s.startsAt.getTime() === slot.startsAt.getTime());
    expect(same?.staffIds ?? []).not.toContain(row.staff_id);
  });

  it("rejects times that aren't offered", async () => {
    await expect(
      bookConsultation(input("2026-11-07T10:00:00.000Z"), { customerUserId: null, now: NOW }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects formats the service doesn't offer", async () => {
    const a = await getAvailability("trip-planning-call", NOW, 7);
    await expect(
      bookConsultation(input(a!.slots[5].startsAt.toISOString(), { format: "in_person" }), {
        customerUserId: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("is idempotent for the same client key", async () => {
    const a = await getAvailability("trip-planning-call", NOW, 7);
    const key = crypto.randomUUID();
    const v = input(a!.slots[8].startsAt.toISOString());
    const one = await bookConsultation(v, { customerUserId: null, idempotencyKey: key, now: NOW });
    const two = await bookConsultation(v, { customerUserId: null, idempotencyKey: key, now: NOW });
    expect(two).toMatchObject({ reference: one.reference, duplicate: true });
  });

  it("never double-books a consultant under concurrent requests", async () => {
    const a = await getAvailability("trip-planning-call", NOW, 7);
    const slot = a!.slots.find((s) => s.staffIds.length >= 1 && s.startsAt.toISOString().startsWith("2026-11-04"))!;
    const capacity = slot.staffIds.length;
    const results = await Promise.allSettled(
      Array.from({ length: capacity + 3 }, () =>
        bookConsultation(input(slot.startsAt.toISOString()), { customerUserId: null, now: NOW }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(capacity);
    const rows =
      await sql`select staff_id from consultations where starts_at = ${slot.startsAt} and status = 'confirmed'`;
    expect(new Set(rows.map((r) => r.staff_id)).size).toBe(rows.length);
  });

  it("is backed by a database exclusion constraint", async () => {
    const [c] = await sql`select * from consultations limit 1`;
    await expect(sql`
      insert into consultations (id, reference, service_id, contact_name, contact_email, staff_id, starts_at, ends_at, format, status, idempotency_key)
      values (gen_random_uuid(), 'CN-TEST-0001', ${c.service_id}, 'X', 'x@orbis.example', ${c.staff_id}, ${c.starts_at}, ${c.ends_at}, 'video', 'confirmed', 'test-overlap')
    `).rejects.toThrow(/consultations_no_overlap/);
  });
});
