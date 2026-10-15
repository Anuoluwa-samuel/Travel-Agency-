import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { getPublishedSlugs } from "@/server/services/catalogue/queries";
import { listConsultationServices } from "@/server/services/consultations/service";
import { getArticleSlugs } from "@/server/services/content/articles";

/** Published, indexable pages only. Filter combinations and private areas are excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ destinations, packages }, guides, services] = await Promise.all([
    getPublishedSlugs(),
    getArticleSlugs(),
    listConsultationServices(),
  ]);
  const staticPages = [
    "",
    "/destinations",
    "/packages",
    "/flights",
    "/hotels",
    "/guides",
    "/consultations",
    "/contact",
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  return [
    ...staticPages,
    ...destinations.map((d) => ({
      url: `${siteUrl}/destinations/${d.slug}`,
      lastModified: d.updatedAt,
      priority: 0.8,
    })),
    ...packages.map((p) => ({ url: `${siteUrl}/packages/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
    ...guides.map((g) => ({ url: `${siteUrl}/guides/${g.slug}`, lastModified: g.updatedAt, priority: 0.6 })),
    ...services.map((s) => ({ url: `${siteUrl}/consultations/${s.slug}`, priority: 0.5 })),
  ];
}
