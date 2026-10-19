import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/feedback/states";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { siteUrl } from "@/config/site";
import { formatDate } from "@/lib/dates";
import { listArticles } from "@/server/services/content/articles";

export const metadata: Metadata = {
  title: "Travel guides",
  description: "Practical guides for planning, budgeting and preparing for international trips.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const articles = await listArticles();
  const [lead, ...rest] = articles;
  return (
    <div className="container-page flex flex-col gap-12 py-10 md:py-14">
      <div className="flex max-w-2xl flex-col gap-4">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Guides", href: "/guides" },
          ]}
        />
        <h1 className="text-4xl md:text-5xl">Travel guides</h1>
        <p className="text-lg text-muted-foreground">
          Practical advice from our consultants, dated so you know how current it is.
        </p>
      </div>

      {!lead ? (
        <EmptyState
          icon={BookOpen}
          title="Guides are on their way"
          description="Our first travel guides will appear here soon."
        />
      ) : (
        <>
          <article className="group surface-dark relative grid gap-4 rounded-lg bg-navy-900 p-8 text-navy-100 md:p-12">
            <p className="eyebrow">Latest guide</p>
            <h2 className="max-w-3xl text-3xl text-cloud-50 md:text-4xl">
              <Link href={`/guides/${lead.slug}`} className="after:absolute after:inset-0">
                {lead.title}
              </Link>
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed">{lead.excerpt}</p>
            <Meta a={lead} />
          </article>
          {rest.length > 0 && (
            <ul className="grid gap-x-10 gap-y-10 md:grid-cols-2">
              {rest.map((a) => (
                <li key={a.slug} className="relative flex flex-col gap-3 border-t pt-6">
                  <h2 className="text-2xl">
                    <Link href={`/guides/${a.slug}`} className="after:absolute after:inset-0">
                      {a.title}
                    </Link>
                  </h2>
                  <p className="leading-relaxed text-muted-foreground">{a.excerpt}</p>
                  <Meta a={a} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Meta({ a }: { a: { readingMinutes: number; reviewedAt: Date | null; publishedAt: Date | null } }) {
  const date = a.reviewedAt ?? a.publishedAt;
  return (
    <p className="text-sm opacity-80">
      {a.readingMinutes} min read
      {date && ` · ${a.reviewedAt ? "Reviewed" : "Published"} ${formatDate(date)}`}
    </p>
  );
}
