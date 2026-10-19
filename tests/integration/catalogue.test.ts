import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, updateTag: () => {} }));

const q = await import("@/server/services/catalogue/queries");
const { parseDestinationFilters } = await import("@/lib/validation/catalogue");
const { seed } = await import("@/server/db/seed");

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
});
afterAll(async () => {
  await sql.end();
});

describe("catalogue publication rules", () => {
  it("hides drafts and future-scheduled destinations everywhere", async () => {
    await sql`update destinations set status = 'draft' where slug = 'lisbon'`;
    await sql`update destinations set published_at = now() + interval '1 day' where slug = 'accra'`;
    try {
      const { items } = await q.listDestinations(parseDestinationFilters({}));
      const slugs = items.map((i) => i.slug);
      expect(slugs).not.toContain("lisbon");
      expect(slugs).not.toContain("accra");
      expect(await q.getDestination("lisbon")).toBeNull();
      expect(await q.getDestination("accra")).toBeNull();
      const { destinations } = await q.getPublishedSlugs();
      expect(destinations.map((d) => d.slug)).not.toContain("lisbon");
    } finally {
      await sql`update destinations set status = 'published', published_at = now() - interval '1 minute' where slug in ('lisbon', 'accra')`;
    }
  });
});

describe("listDestinations filters", () => {
  const run = (sp: Record<string, string | string[]>) =>
    q.listDestinations(parseDestinationFilters(sp)).then((r) => r.items.map((i) => i.slug).sort());

  it("searches by name, country and summary", async () => {
    expect(await run({ q: "zanzibar" })).toEqual(["zanzibar"]);
    expect(await run({ q: "portugal" })).toEqual(["lisbon"]);
    expect(await run({ q: "50% off" })).toEqual([]); // LIKE wildcards are escaped
  });

  it("filters by region, category (any of), month and budget", async () => {
    expect(await run({ region: "europe" })).toEqual(["lisbon"]);
    expect(await run({ category: ["honeymoon", "weekend-escapes"] })).toEqual(["accra", "dubai", "zanzibar"]);
    expect(await run({ month: "7" })).toEqual(["zanzibar"]);
    expect(await run({ budget: "value" })).toEqual(["accra", "marrakech", "zanzibar"]);
  });

  it("paginates with a stable total", async () => {
    const r = await q.listDestinations(parseDestinationFilters({ sort: "name" }));
    expect(r.total).toBe(6);
    expect(r.pageCount).toBe(1);
    expect(r.items[0].slug).toBe("accra");
  });
});

describe("getPackage", () => {
  it("returns the structured package with a server-computed from price", async () => {
    const p = await q.getPackage("zanzibar-stone-town-and-beach-7-days");
    expect(p).not.toBeNull();
    expect(p!.days).toHaveLength(7);
    expect(p!.days[1].items.some((i) => i.isOptional)).toBe(true);
    expect(p!.included.length).toBeGreaterThan(0);
    expect(p!.departures.length).toBe(2);
    expect(p!.departures[0].availability).toBe("open");
    const twin = p!.rooms.find((r) => r.name.startsWith("Twin"))!;
    expect(p!.departures[0].prices[twin.id]).toEqual({ amountMinor: 165_000_000n, currency: "NGN" });
    expect(p!.addons.every((a) => a.price !== null)).toBe(true);
    // Seat counts must not leak to the public payload.
    expect(JSON.stringify(p!.departures, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(
      /capacity|seats/,
    );
    expect(p!.fromPrice).toEqual({ amountMinor: 165_000_000n, currency: "NGN" });
    expect(p!.cancellationPolicy?.title).toMatch(/DRAFT/);
  });

  it("drops the from price when every departure is closed", async () => {
    await sql`update package_departures set status = 'closed'`;
    try {
      const p = await q.getPackage("zanzibar-stone-town-and-beach-7-days");
      expect(p!.fromPrice).toBeNull();
      expect(p!.departures.every((d) => d.availability === "closed")).toBe(true);
    } finally {
      await sql`update package_departures set status = 'open'`;
    }
  });
});
