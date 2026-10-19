import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./_shared";
import { destinations, mediaAssets, publicationStatus } from "./catalogue";
import { users } from "./identity";

/*
 * Content (data-model §12): travel guides and articles. Bodies use a small, safe text format
 * (headings, paragraphs, lists, links) rendered without raw HTML — see lib/content/render.
 */

export const articles = pgTable(
  "articles",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    body: text("body").notNull(),
    heroMediaId: uuid("hero_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    authorStaffId: uuid("author_staff_id").references(() => users.id, { onDelete: "set null" }),
    /** Shown publicly so readers know how current the advice is. */
    reviewedAt: tstz("reviewed_at"),
    readingMinutes: smallint("reading_minutes").notNull().default(3),
    status: publicationStatus("status").notNull().default("draft"),
    publishedAt: tstz("published_at"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    archivedAt: tstz("archived_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("articles_slug_uq").on(t.slug),
    index("articles_status_idx").on(t.status, t.publishedAt),
    check("articles_reading_minutes", sql`${t.readingMinutes} BETWEEN 1 AND 120`),
  ],
);

export const articleDestinations = pgTable(
  "article_destinations",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.destinationId] }),
    index("article_destinations_dest_idx").on(t.destinationId),
  ],
);
