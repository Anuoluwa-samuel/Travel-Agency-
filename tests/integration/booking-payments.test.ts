import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Booking and payment flows against the real test database. External effects are replaced:
 * emails are captured in memory, cookies live in a jar, payments use the simulated provider.
 */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    has: (k: string) => jar.has(k),
  }),
}));
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, updateTag: () => {} }));
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/server/integrations/email", () => ({
  getEmailProvider: () => ({
    key: "test",
    simulated: true,
    send: async (m: { to: string; subject: string; text: string }) => {
      sent.push(m);
      return { provider: "test", providerMessageId: null, delivered: false };
    },
  }),
}));

const { createQuote, createBookingFromQuote } = await import("@/server/services/booking/create");
const { releaseExpiredHolds } = await import("@/server/services/booking/expiry");
const { requestCancellation, previewCancellation } = await import("@/server/services/booking/cancel");
const { requestGuestCode, verifyGuestCode } = await import("@/server/services/booking/guest");
const { getBookingForViewer } = await import("@/server/services/booking/access");
const { startPayment, handlePaymentWebhook, confirmPaymentReturn } = await import("@/server/services/payments/service");
const { buildMockChargeEvent } = await import("@/server/integrations/payments/mock");
const { decryptField } = await import("@/server/lib/crypto");
const { seed } = await import("@/server/db/seed");

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const CAPE = "cape-town-city-and-winelands-5-days";
const ZANZIBAR = "zanzibar-stone-town-and-beach-7-days";

async function ids(slug: string) {
  const [p] = await sql`select id from packages where slug = ${slug}`;
  const deps =
    await sql`select id, capacity, seats_held, seats_confirmed from package_departures where package_id = ${p.id} order by start_date`;
  const opts = await sql`select id, code from package_options where package_id = ${p.id}`;
  const opt = (code: string) => opts.find((o) => o.code === code)!.id as string;
  return { packageId: p.id as string, departures: deps, opt };
}

const traveller = (type: "adult" | "child", n: number, extra: Record<string, unknown> = {}) => ({
  type,
  firstName: `Test${n}`,
  lastName: "Traveller",
  ...extra,
});

async function book(
  slug: string,
  opts: { adults?: number; departureIndex?: number; now?: Date; key?: string; addon?: boolean } = {},
) {
  const i = await ids(slug);
  const adults = opts.adults ?? 2;
  const rooms = Array.from({ length: Math.ceil(adults / 2) }, (_, k) => ({
    optionId: i.opt("TWIN"),
    adults: Math.min(2, adults - k * 2),
    children: 0,
  }));
  const q = await createQuote(
    slug,
    { departureId: i.departures[opts.departureIndex ?? 0].id, rooms, addons: [] },
    { customerUserId: null, now: opts.now },
  );
  const res = await createBookingFromQuote(
    {
      quoteReference: q.quote.reference,
      contact: {
        name: "Test Booker",
        email: `b-${Math.random().toString(36).slice(2)}@orbis.example`,
        phone: "+234 800 000 0000",
      },
      travellers: Array.from({ length: adults }, (_, n) =>
        traveller("adult", n, n === 0 ? { passportNumber: "A12345678", dateOfBirth: "1990-05-01" } : {}),
      ),
      acceptTerms: true,
    },
    { customerUserId: null, idempotencyKey: opts.key, now: opts.now },
  );
  return { quote: q, res, ids: i };
}

async function pay(bookingId: string, choice: "next" | "full" = "next") {
  const start = await startPayment(bookingId, choice, null);
  const [attempt] = await sql`select amount_minor, currency from payment_attempts where reference = ${start.reference}`;
  const evt = buildMockChargeEvent({
    reference: start.reference,
    amountMinor: BigInt(attempt.amount_minor),
    currency: attempt.currency.trim(),
    outcome: "success",
  });
  const r = await handlePaymentWebhook("mock", evt.body, new Headers({ "x-mock-signature": evt.signature }));
  return { start, evt, r };
}

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
});
beforeEach(async () => {
  jar.clear();
  sent.length = 0;
  // Each test books seats; keep plenty free so tests don't depend on run order.
  await sql`update package_departures set capacity = seats_held + seats_confirmed + 20`;
});
afterAll(async () => {
  await sql.end();
});

describe("instant booking", () => {
  it("creates a held booking with invoice, schedule, ledger and encrypted traveller data", async () => {
    const { res, ids: i } = await book(CAPE);
    expect(res.kind).toBe("created");
    if (res.kind !== "created") return;
    expect(res.status).toBe("awaiting_payment");

    const [b] = await sql`select * from bookings where id = ${res.bookingId}`;
    expect(BigInt(b.total_minor)).toBe(240_000_000n);
    expect(BigInt(b.deposit_minor)).toBe(72_000_000n);
    expect(b.expires_at).not.toBeNull();

    const [dep] = await sql`select seats_held from package_departures where id = ${i.departures[0].id}`;
    expect(dep.seats_held).toBe(i.departures[0].seats_held + 2);

    const sched =
      await sql`select s.label, s.amount_minor, s.status from payment_schedule_items s join invoices v on v.id = s.invoice_id where v.booking_id = ${res.bookingId} order by position`;
    expect(sched.map((s) => [s.label, BigInt(s.amount_minor)])).toEqual([
      ["Deposit", 72_000_000n],
      ["Balance", 168_000_000n],
    ]);
    const [{ total }] =
      await sql`select sum(amount_minor)::bigint total from ledger_entries where booking_id = ${res.bookingId}`;
    expect(BigInt(total)).toBe(240_000_000n);

    const [lead] =
      await sql`select passport_number_enc, passport_last4, date_of_birth_enc from booking_travellers where booking_id = ${res.bookingId} and is_lead = 1`;
    expect(lead.passport_number_enc).not.toContain("A12345678");
    expect(lead.passport_last4).toBe("5678");
    expect(decryptField(lead.passport_number_enc, res.bookingId)).toBe("A12345678");
    expect(() => decryptField(lead.passport_number_enc, "another-booking")).toThrow();

    const history =
      await sql`select from_status, to_status from booking_status_history where booking_id = ${res.bookingId} order by created_at`;
    expect(history.map((h) => h.to_status)).toEqual(["draft", "awaiting_payment"]);
  });

  it("is idempotent for the same client key", async () => {
    const key = crypto.randomUUID();
    const i = await ids(CAPE);
    const q = await createQuote(
      CAPE,
      { departureId: i.departures[1].id, rooms: [{ optionId: i.opt("SGL"), adults: 1, children: 0 }], addons: [] },
      { customerUserId: null },
    );
    const req = {
      quoteReference: q.quote.reference,
      contact: { name: "Same", email: "same@orbis.example", phone: "+234 800 000 0001" },
      travellers: [traveller("adult", 0)],
      acceptTerms: true as const,
    };
    const a = await createBookingFromQuote(req, { customerUserId: null, idempotencyKey: key });
    const b = await createBookingFromQuote(req, { customerUserId: null, idempotencyKey: key });
    expect(b).toMatchObject({ kind: "created", duplicate: true, reference: (a as { reference: string }).reference });
  });

  it("stops with a new quote when the price changed since quoting", async () => {
    const i = await ids(CAPE);
    const q = await createQuote(
      CAPE,
      { departureId: i.departures[1].id, rooms: [{ optionId: i.opt("SGL"), adults: 1, children: 0 }], addons: [] },
      { customerUserId: null },
    );
    await sql`update price_rules set amount_minor = amount_minor + 1000000 where option_id = ${i.opt("SGL")}`;
    try {
      const res = await createBookingFromQuote(
        {
          quoteReference: q.quote.reference,
          contact: { name: "P", email: "p@orbis.example", phone: "+234 800 000 0002" },
          travellers: [traveller("adult", 0)],
          acceptTerms: true,
        },
        { customerUserId: null },
      );
      expect(res.kind).toBe("price_changed");
      if (res.kind === "price_changed") expect(res.newTotalMinor - res.oldTotalMinor).toBe(1_000_000n);
      const [old] = await sql`select status from quotes where reference = ${q.quote.reference}`;
      expect(old.status).toBe("superseded");
    } finally {
      await sql`update price_rules set amount_minor = amount_minor - 1000000 where option_id = ${i.opt("SGL")}`;
    }
  });

  it("never oversells a departure under concurrent bookings", async () => {
    const i = await ids(CAPE);
    const dep = i.departures[1];
    // Exactly 10 free seats: five 4-person bookings race, only two can fit.
    await sql`update package_departures set capacity = seats_held + seats_confirmed + 10 where id = ${dep.id}`;
    const [fresh] =
      await sql`select capacity, seats_held, seats_confirmed from package_departures where id = ${dep.id}`;
    const free = fresh.capacity - fresh.seats_held - fresh.seats_confirmed;
    const quotesList = [];
    for (let n = 0; n < 5; n++) {
      quotesList.push(
        await createQuote(
          CAPE,
          {
            departureId: dep.id,
            rooms: [
              { optionId: i.opt("TWIN"), adults: 2, children: 0 },
              { optionId: i.opt("TWIN"), adults: 2, children: 0 },
            ],
            addons: [],
          },
          { customerUserId: null },
        ).catch(() => null),
      );
    }
    const valid = quotesList.filter((q): q is NonNullable<typeof q> => q !== null);
    const results = await Promise.allSettled(
      valid.map((q, n) =>
        createBookingFromQuote(
          {
            quoteReference: q.quote.reference,
            contact: { name: "Race", email: `race${n}@orbis.example`, phone: "+234 800 000 0003" },
            travellers: [0, 1, 2, 3].map((k) => traveller("adult", k)),
            acceptTerms: true,
          },
          { customerUserId: null },
        ),
      ),
    );
    const created = results.filter((r) => r.status === "fulfilled" && r.value.kind === "created");
    expect(free).toBe(10);
    expect(created.length).toBe(2);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.every((r) => (r as PromiseRejectedResult).reason.code === "CONFLICT")).toBe(true);
    const [after] =
      await sql`select capacity, seats_held, seats_confirmed from package_departures where id = ${dep.id}`;
    expect(after.seats_held + after.seats_confirmed).toBeLessThanOrEqual(after.capacity);
  });
});

describe("payments", () => {
  it("records a verified deposit once and confirms the booking (J05)", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const { start, r } = await pay(res.bookingId);
    expect(start.simulated).toBe(true);
    expect(r.status).toBe(200);

    const [b] =
      await sql`select status, paid_minor, balance_minor, expires_at from bookings where id = ${res.bookingId}`;
    expect(b.status).toBe("confirmed");
    expect(BigInt(b.paid_minor)).toBe(72_000_000n);
    expect(BigInt(b.balance_minor)).toBe(168_000_000n);
    expect(b.expires_at).toBeNull();

    const [{ total }] =
      await sql`select sum(amount_minor)::bigint total from ledger_entries where booking_id = ${res.bookingId}`;
    expect(BigInt(total)).toBe(BigInt(b.balance_minor)); // ledger reconciles with the booking

    const [hold] = await sql`select status from inventory_holds where booking_id = ${res.bookingId}`;
    expect(hold.status).toBe("converted");
    const sched =
      await sql`select s.status from payment_schedule_items s join invoices v on v.id = s.invoice_id where v.booking_id = ${res.bookingId} order by position`;
    expect(sched.map((s) => s.status)).toEqual(["paid", "pending"]);
    expect(sent.some((m) => m.subject.startsWith("Payment received"))).toBe(true);
  });

  it("ignores a duplicate webhook delivery (J06)", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const { evt } = await pay(res.bookingId);
    const again = await handlePaymentWebhook("mock", evt.body, new Headers({ "x-mock-signature": evt.signature }));
    expect(again).toMatchObject({ status: 200, duplicate: true });

    // A different event id for the same charge (provider retry) is also absorbed.
    const [attempt] =
      await sql`select reference, amount_minor from payment_attempts where booking_id = ${res.bookingId}`;
    const retry = buildMockChargeEvent({
      reference: attempt.reference,
      amountMinor: BigInt(attempt.amount_minor),
      currency: "NGN",
      outcome: "success",
      eventId: "retry-1",
    });
    const r3 = await handlePaymentWebhook("mock", retry.body, new Headers({ "x-mock-signature": retry.signature }));
    expect(r3).toMatchObject({ status: 200, result: { kind: "duplicate" } });

    const [{ n }] = await sql`select count(*)::int n from transactions where booking_id = ${res.bookingId}`;
    const [{ l }] = await sql`select count(*)::int l from ledger_entries where booking_id = ${res.bookingId}`;
    expect(n).toBe(1);
    expect(l).toBe(2); // charge_due + one payment_received
    expect(await confirmPaymentReturn(res.bookingId, attempt.reference)).toEqual({ state: "paid" });
  });

  it("pays the balance and marks the invoice paid", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    await pay(res.bookingId);
    await pay(res.bookingId);
    const [b] = await sql`select status, balance_minor from bookings where id = ${res.bookingId}`;
    expect(b).toMatchObject({ status: "confirmed" });
    expect(BigInt(b.balance_minor)).toBe(0n);
    const [inv] = await sql`select status from invoices where booking_id = ${res.bookingId}`;
    expect(inv.status).toBe("paid");
    await expect(startPayment(res.bookingId, "next", null)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects webhooks with a bad signature and records nothing", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const start = await startPayment(res.bookingId, "next", null);
    const evt = buildMockChargeEvent({
      reference: start.reference,
      amountMinor: 72_000_000n,
      currency: "NGN",
      outcome: "success",
    });
    const r = await handlePaymentWebhook("mock", evt.body, new Headers({ "x-mock-signature": "0".repeat(128) }));
    expect(r.status).toBe(401);
    const [{ n }] = await sql`select count(*)::int n from transactions where booking_id = ${res.bookingId}`;
    expect(n).toBe(0);
  });

  it("does not treat an unverified return as payment", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const start = await startPayment(res.bookingId, "next", null);
    expect(await confirmPaymentReturn(res.bookingId, start.reference)).toEqual({ state: "pending" });
    const [b] = await sql`select status from bookings where id = ${res.bookingId}`;
    expect(b.status).toBe("awaiting_payment");
  });

  it("reuses a pending checkout instead of creating duplicates", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const a = await startPayment(res.bookingId, "next", null);
    const b = await startPayment(res.bookingId, "next", null);
    expect(b.reference).toBe(a.reference);
  });

  it("keeps financial history append-only", async () => {
    await expect(sql`update ledger_entries set amount_minor = 1`).rejects.toThrow(/append-only/);
    await expect(sql`delete from transactions`).rejects.toThrow(/append-only/);
    await expect(sql`update booking_status_history set note = 'x'`).rejects.toThrow(/append-only/);
  });
});

describe("request to book", () => {
  it("submits a request without an invoice and holds seats", async () => {
    const { res } = await book(ZANZIBAR);
    expect(res).toMatchObject({ kind: "created", status: "request_submitted" });
    if (res.kind !== "created") return;
    const [{ n }] = await sql`select count(*)::int n from invoices where booking_id = ${res.bookingId}`;
    expect(n).toBe(0);
    await expect(startPayment(res.bookingId, "next", null)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("expiry", () => {
  it("expires unpaid holds and returns the seats", async () => {
    const past = new Date(Date.now() - 2 * 3_600_000);
    const { res, ids: i } = await book(CAPE, { now: past, departureIndex: 1, adults: 1 });
    if (res.kind !== "created") throw new Error("not created");
    const [before] = await sql`select seats_held from package_departures where id = ${i.departures[1].id}`;
    const out = await releaseExpiredHolds(new Date());
    expect(out.expired).toContain(res.bookingId);
    const [b] = await sql`select status from bookings where id = ${res.bookingId}`;
    expect(b.status).toBe("expired");
    const [after] = await sql`select seats_held from package_departures where id = ${i.departures[1].id}`;
    expect(after.seats_held).toBe(before.seats_held - 1);
    // Running again changes nothing.
    expect((await releaseExpiredHolds(new Date())).expired).not.toContain(res.bookingId);
  });
});

describe("cancellation", () => {
  it("previews and freezes the policy charge on the request (J17)", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    await pay(res.bookingId);
    const preview = await previewCancellation(res.bookingId);
    expect(preview).toMatchObject({ manualReview: false });
    const out = await requestCancellation(res.bookingId, {
      reason: "Change of plans",
      actor: { type: "customer", id: null },
    });
    // 75 days out → first tier (deposit forfeited); paid = deposit → nothing refundable.
    expect(out.penaltyMinor).toBe(72_000_000n);
    expect(out.refundableMinor).toBe(0n);
    const [b] = await sql`select status from bookings where id = ${res.bookingId}`;
    expect(b.status).toBe("cancellation_requested");
    await expect(
      requestCancellation(res.bookingId, { reason: "again", actor: { type: "customer", id: null } }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("guest access", () => {
  it("emails a one-time code and grants access only with the right code (J04)", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const [b] = await sql`select reference, contact_email from bookings where id = ${res.bookingId}`;

    expect(await getBookingForViewer(b.reference)).toBeNull(); // reference alone is not enough

    await requestGuestCode(b.reference, "wrong@orbis.example");
    expect(sent).toHaveLength(0); // no hint that the booking exists

    await requestGuestCode(b.reference.toLowerCase().replace(/-/g, ""), b.contact_email.toUpperCase());
    const code = /code: (\d{6})/.exec(sent[0].subject)![1];

    expect(await verifyGuestCode(b.reference, code === "000000" ? "111111" : "000000")).toBeNull();
    expect(await verifyGuestCode(b.reference, code)).toBe(b.reference);
    expect(await verifyGuestCode(b.reference, code)).toBeNull(); // single use

    const view = await getBookingForViewer(b.reference);
    expect(view?.viewer.kind).toBe("guest");
  });

  it("locks the code after repeated wrong guesses", async () => {
    const { res } = await book(CAPE);
    if (res.kind !== "created") throw new Error("not created");
    const [b] = await sql`select reference, contact_email from bookings where id = ${res.bookingId}`;
    await requestGuestCode(b.reference, b.contact_email);
    const code = /code: (\d{6})/.exec(sent[0].subject)![1];
    const wrong = code === "123456" ? "654321" : "123456";
    for (let k = 0; k < 5; k++) await verifyGuestCode(b.reference, wrong);
    expect(await verifyGuestCode(b.reference, code)).toBeNull();
  });
});
