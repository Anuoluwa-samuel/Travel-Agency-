import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, updateTag: () => {} }));

const { getArticle, listArticles, getArticlesForDestination } = await import("@/server/services/content/articles");
const { seed } = await import("@/server/db/seed");
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

beforeAll(async () => {
  await seed(process.env.DATABASE_URL!);
});
afterAll(async () => {
  await sql.end();
});

describe("articles", () => {
  it("lists published guides with linked destinations", async () => {
    const list = await listArticles();
    expect(list.map((a) => a.slug).sort()).toEqual([
      "beach-holiday-packing-checklist",
      "how-to-budget-for-your-first-international-trip",
    ]);
    expect(
      list
        .find((a) => a.slug === "beach-holiday-packing-checklist")!
        .destinations.map((d) => d.slug)
        .sort(),
    ).toEqual(["cape-town", "zanzibar"]);
  });

  it("hides drafts from lists, detail pages and destination links", async () => {
    await sql`update articles set status = 'draft' where slug = 'beach-holiday-packing-checklist'`;
    try {
      expect((await listArticles()).map((a) => a.slug)).not.toContain("beach-holiday-packing-checklist");
      expect(await getArticle("beach-holiday-packing-checklist")).toBeNull();
      const [z] = await sql`select id from destinations where slug = 'zanzibar'`;
      expect(await getArticlesForDestination(z.id)).toEqual([]);
    } finally {
      await sql`update articles set status = 'published' where slug = 'beach-holiday-packing-checklist'`;
    }
  });
});
