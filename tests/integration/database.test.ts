import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ROLES } from "@/server/auth/permissions";
import { seed } from "@/server/db/seed";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sql.end();
});

describe("seed", () => {
  it("is idempotent", async () => {
    const count = async () =>
      (
        await sql`select (select count(*) from users)::int u, (select count(*) from destinations)::int d, (select count(*) from packages)::int p`
      )[0];
    const before = await count();
    await seed(process.env.DATABASE_URL!);
    expect(await count()).toEqual(before);
  });

  it("writes every permission and the exact role grants from code", async () => {
    const [{ n }] = await sql`select count(*)::int n from permissions`;
    expect(n).toBe(ALL_PERMISSIONS.length);
    const expected = Object.values(ROLES).reduce((acc, r) => acc + r.permissions.length, 0);
    const [{ g }] = await sql`select count(*)::int g from role_permissions`;
    expect(g).toBe(expected);
  });

  it("labels seeded budgets as fictional", async () => {
    const rows = await sql`select distinct budget_source from destinations`;
    expect(rows.map((r) => r.budget_source)).toEqual(["ORBIS demo data (fictional, not verified)"]);
  });
});

describe("append-only audit log", () => {
  it("rejects UPDATE, DELETE and TRUNCATE", async () => {
    const [{ id }] =
      await sql`insert into audit_logs (id, action, entity_type) values (gen_random_uuid(), 'test.action', 'test') returning id`;
    await expect(sql`update audit_logs set action = 'x' where id = ${id}`).rejects.toThrow(/append-only/);
    await expect(sql`delete from audit_logs where id = ${id}`).rejects.toThrow(/append-only/);
    await expect(sql`truncate audit_logs`).rejects.toThrow(/append-only/);
  });
});

describe("catalogue constraints", () => {
  it("prevents overselling a departure at the database level", async () => {
    const [dep] = await sql`select id, capacity from package_departures limit 1`;
    await expect(
      sql`update package_departures set seats_held = ${dep.capacity}, seats_confirmed = 1 where id = ${dep.id}`,
    ).rejects.toThrow(/package_departures_capacity/);
    await sql`update package_departures set seats_held = ${dep.capacity - 1}, seats_confirmed = 1 where id = ${dep.id}`;
    await sql`update package_departures set seats_held = 0, seats_confirmed = 0 where id = ${dep.id}`;
  });

  it("rejects negative prices and malformed currencies", async () => {
    const [rule] = await sql`select id from price_rules limit 1`;
    await expect(sql`update price_rules set amount_minor = -1 where id = ${rule.id}`).rejects.toThrow(
      /price_rules_amount_nonneg/,
    );
    await expect(sql`update price_rules set currency = 'ngn' where id = ${rule.id}`).rejects.toThrow(
      /price_rules_currency/,
    );
  });

  it("allows only one hero image per destination", async () => {
    const [d] = await sql`select id from destinations limit 1`;
    const [m1] =
      await sql`insert into media_assets (id, storage_key, alt) values (gen_random_uuid(), 'test/a.jpg', 'a') returning id`;
    const [m2] =
      await sql`insert into media_assets (id, storage_key, alt) values (gen_random_uuid(), 'test/b.jpg', 'b') returning id`;
    await sql`insert into destination_media (destination_id, media_id, is_hero) values (${d.id}, ${m1.id}, true)`;
    await expect(
      sql`insert into destination_media (destination_id, media_id, is_hero) values (${d.id}, ${m2.id}, true)`,
    ).rejects.toThrow(/destination_media_one_hero/);
  });

  it("treats emails case-insensitively", async () => {
    await expect(
      sql`insert into users (id, name, email) values (gen_random_uuid(), 'Dup', 'TRAVELLER@ORBIS.EXAMPLE')`,
    ).rejects.toThrow(/users_email_lower_uq/);
  });
});
