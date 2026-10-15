import "server-only";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db/client";
import { articleDestinations, articles, destinations, users } from "@/server/db/schema";

/** Published-only reads for guides. Tagged so the CMS can invalidate after edits. */
export const CONTENT_TAG = "content";

const published = and(eq(articles.status, "published"), lte(articles.publishedAt, sql`now()`));

const card = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  readingMinutes: articles.readingMinutes,
  publishedAt: articles.publishedAt,
  reviewedAt: articles.reviewedAt,
};

export async function listArticles() {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  const rows = await db.select(card).from(articles).where(published).orderBy(desc(articles.publishedAt));
  const links = rows.length
    ? await db
        .select({ articleId: articleDestinations.articleId, slug: destinations.slug, name: destinations.name })
        .from(articleDestinations)
        .innerJoin(destinations, eq(destinations.id, articleDestinations.destinationId))
        .where(
          inArray(
            articleDestinations.articleId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  return rows.map((r) => ({ ...r, destinations: links.filter((l) => l.articleId === r.id) }));
}

export async function getArticle(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG, `article:${slug}`);
  const [row] = await db
    .select({
      ...card,
      body: articles.body,
      seoTitle: articles.seoTitle,
      seoDescription: articles.seoDescription,
      updatedAt: articles.updatedAt,
      authorName: users.name,
    })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorStaffId))
    .where(and(eq(articles.slug, slug), published));
  if (!row) return null;
  const [dests, more] = await Promise.all([
    db
      .select({ slug: destinations.slug, name: destinations.name })
      .from(articleDestinations)
      .innerJoin(
        destinations,
        and(eq(destinations.id, articleDestinations.destinationId), eq(destinations.status, "published")),
      )
      .where(eq(articleDestinations.articleId, row.id))
      .orderBy(asc(destinations.name)),
    db
      .select(card)
      .from(articles)
      .where(and(published, sql`${articles.id} <> ${row.id}`))
      .orderBy(desc(articles.publishedAt))
      .limit(3),
  ]);
  return { ...row, destinations: dests, more };
}

export async function getArticleSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return db.select({ slug: articles.slug, updatedAt: articles.updatedAt }).from(articles).where(published);
}

/** Guides that mention a destination, for internal linking from destination pages. */
export async function getArticlesForDestination(destinationId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG);
  return db
    .select({ slug: articles.slug, title: articles.title, excerpt: articles.excerpt })
    .from(articleDestinations)
    .innerJoin(articles, and(eq(articles.id, articleDestinations.articleId), published))
    .where(eq(articleDestinations.destinationId, destinationId))
    .orderBy(desc(articles.publishedAt))
    .limit(3);
}
