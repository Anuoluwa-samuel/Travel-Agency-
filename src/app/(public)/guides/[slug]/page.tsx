import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleBody, tableOfContents } from "@/components/content/article-body";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { siteUrl } from "@/config/site";
import { formatDate } from "@/lib/dates";
import { getArticle, getArticleSlugs } from "@/server/services/content/articles";

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.length ? slugs.map((s) => ({ slug: s.slug })) : [{ slug: "__none" }];
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: "Guide not found", robots: { index: false } };
  return {
    title: a.seoTitle ?? a.title,
    description: a.seoDescription ?? a.excerpt,
    alternates: { canonical: `/guides/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.excerpt, url: `/guides/${a.slug}` },
  };
}

export default function GuidePage(props: PageProps<"/guides/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="container-page my-14 h-[60vh]" />}>
      <Guide params={props.params} />
    </Suspense>
  );
}

async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  const toc = tableOfContents(a.body);
  const dated = a.reviewedAt ?? a.publishedAt;

  return (
    <article className="container-page grid gap-12 py-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-8">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Guides", href: "/guides" },
            { label: a.title, href: `/guides/${a.slug}` },
          ]}
        />
        <header className="flex max-w-3xl flex-col gap-4">
          <h1 className="text-4xl leading-tight md:text-5xl">{a.title}</h1>
          <p className="text-xl leading-relaxed text-muted-foreground">{a.excerpt}</p>
          <p className="text-sm text-muted-foreground">
            {a.authorName && `By ${a.authorName} · `}
            {a.readingMinutes} min read
            {dated && ` · ${a.reviewedAt ? "Reviewed" : "Published"} ${formatDate(dated)}`}
          </p>
          <span className="gold-rule" aria-hidden="true" />
        </header>
        <ArticleBody body={a.body} />
        <p className="max-w-prose border-t pt-6 text-sm text-muted-foreground">
          General guidance only. Prices, rules and entry requirements change; we confirm the details that apply to your
          trip before you book.
        </p>
      </div>
      <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
        {toc.length > 1 && (
          <nav aria-label="On this page" className="flex flex-col gap-2 text-sm">
            <p className="eyebrow mb-1">On this page</p>
            {toc.map((h) => (
              <a key={h.id} href={`#${h.id}`} className="py-1 text-navy-700 hover:text-navy-900">
                {h.text}
              </a>
            ))}
          </nav>
        )}
        {a.destinations.length > 0 && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="eyebrow mb-1">Destinations</p>
            {a.destinations.map((d) => (
              <Link
                key={d.slug}
                href={`/destinations/${d.slug}`}
                className="py-1 text-navy-700 underline-offset-4 hover:underline"
              >
                {d.name}
              </Link>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-lg bg-cloud-100 p-5">
          <p className="font-medium">Want help planning?</p>
          <Button asChild size="sm">
            <Link href="/consultations">Book a free call</Link>
          </Button>
        </div>
      </aside>

      {a.more.length > 0 && (
        <section aria-labelledby="more" className="flex flex-col gap-4 border-t pt-10 lg:col-span-2">
          <h2 id="more" className="text-2xl">
            More guides
          </h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {a.more.map((m) => (
              <li key={m.slug}>
                <Link href={`/guides/${m.slug}`} className="text-lg font-medium underline-offset-4 hover:underline">
                  {m.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{m.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description: a.excerpt,
          url: `${siteUrl}/guides/${a.slug}`,
          ...(a.publishedAt ? { datePublished: a.publishedAt.toISOString() } : {}),
          dateModified: (a.reviewedAt ?? a.updatedAt).toISOString(),
          publisher: { "@type": "Organization", name: brand.name },
        }}
      />
    </article>
  );
}
